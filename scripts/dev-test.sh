#!/bin/bash

# Clean development testing script for Denver Rink Schedule Viewer
# Usage: ./scripts/dev-test.sh [start|stop|test|restart]

set -e

# Configuration
API_PORT=8787
LOG_DIR="./logs"
VERBOSE=false
WORKERS=(
    "data-api:wrangler.toml:8787"
    "ice-ranch:wrangler-ice-ranch.toml:8788"
    "big-bear:wrangler-big-bear.toml:8789"
    "du-ritchie:wrangler-du-ritchie.toml:8790"
    "foothills-edge:wrangler-foothills-edge.toml:8791"
    "ssprd:wrangler-ssprd.toml:8792"
    "apex-ice:wrangler-apex-ice.toml:8793"
)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage information
show_usage() {
cat << 'EOF'
🧊 Denver Rink Schedule Viewer - Development Testing Script

USAGE:
    ./scripts/dev-test.sh [COMMAND] [OPTIONS]

COMMANDS:
    start     Start all workers in development mode
    stop      Stop all running workers
    test      Test all worker endpoints
    restart   Stop and start all workers
    status    Show status of all workers
    help      Show this help message

OPTIONS:
    -v, --verbose    Show detailed response data from endpoints

PORTS:
    8787 - Data API (main API)
    8788 - Ice Ranch scraper
    8789 - Big Bear scraper  
    8790 - DU Ritchie scraper
    8791 - Foothills Edge scraper
    8792 - SSPRD scraper
    8793 - Apex scraper

EXAMPLES:
    ./scripts/dev-test.sh start
    ./scripts/dev-test.sh test
    ./scripts/dev-test.sh test --verbose
    ./scripts/dev-test.sh stop

EOF
}

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if port is in use
is_port_in_use() {
    local port=$1
    nc -z localhost "$port" 2>/dev/null
}

# Get PID using a port
get_pid_using_port() {
    local port=$1
    lsof -ti:"$port" 2>/dev/null || echo ""
}

# Start a single worker
start_worker() {
    local name=$1
    local config=$2
    local port=$3
    
    if is_port_in_use "$port"; then
        log_warning "$name already running on port $port"
        return 0
    fi
    
    log_info "Starting $name on port $port..."
    mkdir -p "$LOG_DIR"
    
    # Start wrangler in background
    wrangler dev --config "$config" --port "$port" --local \
        > "$LOG_DIR/${name}.log" 2>&1 &
    
    local pid=$!
    echo "$pid" > "$LOG_DIR/${name}.pid"
    
    # Wait a moment and check if it started successfully
    sleep 2
    if kill -0 "$pid" 2>/dev/null; then
        log_success "$name started (PID: $pid, Port: $port)"
    else
        log_error "$name failed to start"
        return 1
    fi
}

# Stop a single worker
stop_worker() {
    local name=$1
    local port=$2
    
    local pid_file="$LOG_DIR/${name}.pid"
    
    if [[ -f "$pid_file" ]]; then
        local pid
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping $name (PID: $pid)..."
            kill "$pid"
            rm -f "$pid_file"
            log_success "$name stopped"
        else
            log_warning "$name not running (stale PID file)"
            rm -f "$pid_file"
        fi
    else
        # Check if something is using the port
        local active_pid
        active_pid=$(get_pid_using_port "$port")
        if [[ -n "$active_pid" ]]; then
            log_info "Killing process using port $port (PID: $active_pid)..."
            kill "$active_pid" 2>/dev/null || true
        fi
    fi
}

# Start all workers
start_all() {
    log_info "Starting all workers..."
    mkdir -p "$LOG_DIR"
    
    for worker_def in "${WORKERS[@]}"; do
        IFS=':' read -r name config port <<< "$worker_def"
        start_worker "$name" "$config" "$port"
    done
    
    echo ""
    log_success "All workers started! Waiting 5 seconds for initialization..."
    sleep 5
    show_status
}

# Stop all workers
stop_all() {
    log_info "Stopping all workers..."
    
    for worker_def in "${WORKERS[@]}"; do
        IFS=':' read -r name config port <<< "$worker_def"
        stop_worker "$name" "$port"
    done
    
    # Clean up any remaining processes
    pkill -f "wrangler dev" 2>/dev/null || true
    
    log_success "All workers stopped"
}

# Show status of all workers
show_status() {
    echo ""
    echo "🔍 Worker Status:"
    echo "=================="
    
    for worker_def in "${WORKERS[@]}"; do
        IFS=':' read -r name config port <<< "$worker_def"
        
        if is_port_in_use "$port"; then
            local pid
            pid=$(get_pid_using_port "$port")
            echo -e "${GREEN}✅ $name${NC} - Port $port (PID: $pid)"
        else
            echo -e "${RED}❌ $name${NC} - Port $port (not running)"
        fi
    done
    echo ""
}

# Test worker endpoints
test_worker() {
    local name=$1
    local port=$2
    
    echo "  Testing $name (port $port):"
    
    # Test GET /
    echo -n "    GET / ... "
    local response
    if response=$(curl -s -f "http://localhost:$port/" 2>/dev/null); then
        echo -e "${GREEN}✅${NC}"
        if [[ "$VERBOSE" == "true" ]]; then
            echo "      Response: $response"
        fi
    else
        echo -e "${RED}❌${NC}"
    fi
    
    # Test health endpoint (different for data-api vs scrapers)
    if [[ "$name" == "data-api" ]]; then
        echo -n "    GET /api/health ... "
        local health_response
        if health_response=$(curl -s -f "http://localhost:$port/api/health" 2>/dev/null); then
            echo -e "${GREEN}✅${NC}"
            if [[ "$VERBOSE" == "true" ]]; then
                echo "      Response: $health_response"
            fi
        else
            echo -e "${RED}❌${NC}"
        fi
    else
        echo -n "    GET /status ... "
        local status_response
        if status_response=$(curl -s -f "http://localhost:$port/status" 2>/dev/null); then
            echo -e "${GREEN}✅${NC}"
            if [[ "$VERBOSE" == "true" ]]; then
                echo "      Response: $status_response"
            fi
        else
            echo -e "${RED}❌${NC}"
        fi
    fi
    
    # Test POST / (only for scrapers, not data-api)
    if [[ "$name" != "data-api" ]]; then
        echo -n "    POST / ... "
        local post_response
        if post_response=$(curl -s -f -X POST "http://localhost:$port/" 2>/dev/null); then
            echo -e "${GREEN}✅${NC}"
            if [[ "$VERBOSE" == "true" ]]; then
                echo "      Response: $post_response"
            fi
        else
            echo -e "${RED}❌${NC}"
        fi
    fi
}

# Test data API endpoints
test_data_api() {
    local port=$API_PORT
    
    if ! is_port_in_use "$port"; then
        log_error "Data API not running on port $port"
        return 1
    fi
    
    echo "  Testing Data API endpoints:"
    
    # Test main API endpoints
    echo -n "    GET /api/all-events ... "
    local all_events_response
    if all_events_response=$(curl -s -f "http://localhost:$port/api/all-events" 2>/dev/null); then
        echo -e "${GREEN}✅${NC}"
        if [[ "$VERBOSE" == "true" ]]; then
            echo "      Total events: $(echo "$all_events_response" | jq 'length' 2>/dev/null || echo "unknown")"
        fi
    else
        echo -e "${RED}❌${NC}"
    fi
    
    echo -n "    GET /api/all-metadata ... "
    local all_metadata_response
    all_metadata_response=$(curl -s -f "http://localhost:$port/api/all-metadata" 2>/dev/null)
    if [[ -n "$all_metadata_response" ]]; then
        echo -e "${GREEN}✅${NC}"
        if [[ "$VERBOSE" == "true" ]]; then
            echo "      Sample metadata:"
            echo "$all_metadata_response" | jq -r '.[0] // "No metadata"' 2>/dev/null | head -3 | sed 's/^/        /'
        fi
    else
        echo -e "${RED}❌${NC}"
    fi
    
    # Test individual rink data endpoints
    local rink_ids=("ice-ranch" "big-bear" "du-ritchie" "foothills-edge" "ssprd-249")
    
    for rink_id in "${rink_ids[@]}"; do
        echo -n "    GET /data/${rink_id}.json ... "
        local rink_data
        rink_data=$(curl -s -f "http://localhost:$port/data/${rink_id}.json" 2>/dev/null)
        if [[ -n "$rink_data" ]]; then
            echo -e "${GREEN}✅${NC}"
            if [[ "$VERBOSE" == "true" ]]; then
                echo "      Events count: $(echo "$rink_data" | jq 'length' 2>/dev/null || echo "unknown")"
                echo "      Sample event from ${rink_id}:"
                echo "$rink_data" | jq '.[0] // "No events"' 2>/dev/null | sed 's/^/        /'
            fi
        else
            echo -e "${RED}❌${NC}"
        fi
        
        echo -n "    GET /data/${rink_id}-metadata.json ... "
        local metadata_response
        metadata_response=$(curl -s -f "http://localhost:$port/data/${rink_id}-metadata.json" 2>/dev/null)
        if [[ -n "$metadata_response" ]]; then
            echo -e "${GREEN}✅${NC}"
            if [[ "$VERBOSE" == "true" ]]; then
                echo "      Last updated: $(echo "$metadata_response" | jq -r '.lastSuccessfulScrape // "unknown"' 2>/dev/null)"
            fi
        else
            echo -e "${RED}❌${NC}"
        fi
    done
}

# Run all tests
run_tests() {
    log_info "Running endpoint tests..."
    echo ""
    
    # Test each worker
    for worker_def in "${WORKERS[@]}"; do
        IFS=':' read -r name config port <<< "$worker_def"
        
        if is_port_in_use "$port"; then
            test_worker "$name" "$port"
        else
            echo -e "  $name: ${RED}❌ Not running${NC}"
        fi
        echo ""
    done
    
    # Test data API specific endpoints
    test_data_api
    
    echo ""
    log_success "Tests completed"
}

# Parse arguments
COMMAND=""
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        start|stop|test|restart|status|help|--help|-h)
            COMMAND="$1"
            shift
            ;;
        *)
            if [[ -z "$COMMAND" ]]; then
                COMMAND="$1"
            else
                log_error "Unknown option: $1"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Default to help if no command provided
if [[ -z "$COMMAND" ]]; then
    COMMAND="help"
fi

# Main command handling
case "$COMMAND" in
    start)
        start_all
        ;;
    stop)
        stop_all
        ;;
    test)
        run_tests
        ;;
    restart)
        stop_all
        sleep 2
        start_all
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        echo ""
        show_usage
        exit 1
        ;;
esac
