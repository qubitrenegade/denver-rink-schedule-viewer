#!/bin/bash

# Advanced multi-worker development script
# Usage: ./dev-workers.sh [--port-start 8787] [--exclude pattern] [--test]

set -e

# Default configuration
PORT_START=8787
EXCLUDE_PATTERNS=()
INCLUDE_PATTERNS=()
LOCAL_FLAG="--local"
LOG_DIR="./logs"
RUN_TESTS=false
AUTO_SCRAPE=false
VERBOSE=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage information
show_usage() {
cat << 'EOF'
🧊 Denver Rink Schedule Viewer - Development Workers Script

USAGE:
    ./scripts/dev-workers.sh [COMMAND] [OPTIONS]

COMMANDS:
    start     Start all workers in development mode (default)
    stop      Stop all running workers
    test      Test all worker endpoints
    scrape    Trigger scraping on all running scraper workers and exit
    restart   Stop and start all workers
    status    Show status of all workers
    help      Show this help message

OPTIONS:
    --port-start PORT    Starting port number (default: 8787)
    --exclude PATTERN    Exclude configs matching pattern (can be used multiple times)
    --include PATTERN    Only include configs matching pattern (can be used multiple times)
    --remote             Run against remote Cloudflare (no --local)
    --test               Run tests after startup (only with start command)
    --auto-scrape        Automatically trigger scraping after startup (only with start command)
    -v, --verbose        Show detailed response data from endpoints

PORTS:
    8787+ - Workers start from this port (configurable with --port-start)
    8787  - Data API (main API) when using default port
    8788+ - Individual scrapers (Ice Ranch, Big Bear, DU Ritchie, etc.)

EXAMPLES:
    ./scripts/dev-workers.sh start
    ./scripts/dev-workers.sh start --test
    ./scripts/dev-workers.sh start --auto-scrape
    ./scripts/dev-workers.sh start --exclude "big-bear"
    ./scripts/dev-workers.sh start --port-start 9000
    ./scripts/dev-workers.sh test --verbose
    ./scripts/dev-workers.sh scrape
    ./scripts/dev-workers.sh stop
    ./scripts/dev-workers.sh restart

EOF
}

# Parse arguments
COMMAND=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --port-start)
      PORT_START="$2"
      shift 2
      ;;
    --exclude)
      EXCLUDE_PATTERNS+=("$2")
      shift 2
      ;;
    --include)
      INCLUDE_PATTERNS+=("$2")
      shift 2
      ;;
    --remote)
      LOCAL_FLAG=""
      shift
      ;;
    --test)
      RUN_TESTS=true
      shift
      ;;
    --auto-scrape)
      AUTO_SCRAPE=true
      shift
      ;;
    -v|--verbose)
      VERBOSE=true
      shift
      ;;
    start|stop|test|scrape|restart|status|help|--help|-h)
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

# Default to start if no command provided
if [[ -z "$COMMAND" ]]; then
  COMMAND="start"
fi

# Create logs directory
mkdir -p "$LOG_DIR"

# Array to store process info
declare -A worker_pids
declare -A worker_ports
declare -A worker_types
declare -A worker_rink_ids

# Function to get available port
get_available_port() {
  local port=$1
  while nc -z localhost "$port" 2>/dev/null; do
    ((port++))
  done
  echo "$port"
}

# Function to extract worker name from config file
get_worker_name() {
  local config_file="$1"
  local name
  name=$(grep "^name = " "$config_file" 2>/dev/null | head -1 | sed 's/name = "\(.*\)"/\1/')
  echo "${name:-$(basename "$config_file" .toml)}"
}

# Function to determine worker type and extract rink ID
get_worker_info() {
  local config_file="$1"
  local name
  name=$(basename "$config_file" .toml)
  
  if [[ "$name" == "wrangler" ]]; then
    echo "data-api:"
  elif [[ "$name" =~ ^wrangler-(.+)$ ]]; then
    local rink_id="${BASH_REMATCH[1]}"
    echo "scraper:$rink_id"
  else
    echo "unknown:"
  fi
}

# Function to get worker emoji
get_worker_emoji() {
  local worker_name="$1"
  case "$worker_name" in
    *"data-api"*) echo "📊" ;;
    *"ice-ranch"*) echo "🧊" ;;
    *"big-bear"*) echo "🐻" ;;
    *"du-ritchie"*) echo "🏫" ;;
    *"foothills"*) echo "⛸️" ;;
    *"ssprd"*) echo "🏢" ;;
    *"apex-ice"*) echo "🏔️" ;;
    *) echo "🔧" ;;
  esac
}

# Function to check if config should be included
should_include_config() {
  local config="$1"
  
  # Check include patterns (if any specified, config must match at least one)
  if [[ ${#INCLUDE_PATTERNS[@]} -gt 0 ]]; then
    local matched=false
    for pattern in "${INCLUDE_PATTERNS[@]}"; do
      if [[ "$config" =~ $pattern ]]; then
        matched=true
        break
      fi
    done
    if [[ "$matched" == false ]]; then
      return 1
    fi
  fi
  
  # Check exclude patterns (if any match, exclude the config)
  for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    if [[ "$config" =~ $pattern ]]; then
      return 1
    fi
  done
  
  return 0
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

# Test a single worker's endpoints
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
    
    # Test health/status endpoint (different for data-api vs scrapers)
    if [[ "$name" == *"data-api"* ]]; then
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
    if [[ "$name" != *"data-api"* ]]; then
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

# Test comprehensive data API endpoints
test_data_api() {
    local port=$1
    
    if ! nc -z localhost "$port" 2>/dev/null; then
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
    
    # Dynamically discover rink IDs from collected data
    local rink_ids=()
    for worker_name in "${!worker_types[@]}"; do
        local type=${worker_types[$worker_name]}
        local rink_id=${worker_rink_ids[$worker_name]}
        if [[ "$type" == "scraper" && -n "$rink_id" ]]; then
            rink_ids+=("$rink_id")
        fi
    done
    
    # Test individual rink data endpoints
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

# Show status of all workers
show_status() {
  log_info "Worker Status:"
  echo "=================="
  
  local any_running=false
  
  # Check running workers by scanning PID files and ports
  for config in wrangler*.toml; do
    if [[ -f "$config" ]] && should_include_config "$config"; then
      local worker_name
      worker_name=$(get_worker_name "$config")
      local worker_info
      worker_info=$(get_worker_info "$config")
      local worker_type="${worker_info%%:*}"
      local emoji
      emoji=$(get_worker_emoji "$worker_name")
      
      local pid_file="$LOG_DIR/${worker_name}.pid"
      local is_running=false
      local pid=""
      local port=""
      
      # Check PID file first
      if [[ -f "$pid_file" ]]; then
        pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
          is_running=true
          # Try to find port from worker arrays or scan
          port=${worker_ports[$worker_name]:-"unknown"}
        else
          # Stale PID file
          rm -f "$pid_file"
        fi
      fi
      
      if [[ "$is_running" == "true" ]]; then
        log_success "$emoji $worker_name - Running (PID: $pid, Port: $port)"
        any_running=true
      else
        log_error "$emoji $worker_name - Not running"
      fi
    fi
  done
  
  if [[ "$any_running" == "false" ]]; then
    echo ""
    log_info "No workers are currently running"
    log_info "Use './scripts/dev-workers.sh start' to start workers"
  fi
  echo ""
}

# Stop all workers
stop_all_workers() {
  log_info "Stopping all workers..."
  
  # Stop workers using PID files
  local stopped_any=false
  for pid_file in "$LOG_DIR"/*.pid; do
    if [[ -f "$pid_file" ]]; then
      local worker_name
      worker_name=$(basename "$pid_file" .pid)
      stop_worker "$worker_name"
      stopped_any=true
    fi
  done
  
  if [[ "$stopped_any" == "false" ]]; then
    log_info "No workers were running"
  else
    # Clean up any remaining processes
    pkill -f "wrangler dev" 2>/dev/null || true
    log_success "All workers stopped"
  fi
}

# Function to trigger scraping on all running scrapers
run_scrapers() {
  log_info "Triggering scraping on all running scrapers..."
  echo "================================"
  
  local scraped_any=false
  local failed_scrapers=()
  
  # Find running scrapers by checking PID files and ports
  for config in wrangler*.toml; do
    if [[ -f "$config" ]] && should_include_config "$config"; then
      local worker_name
      worker_name=$(get_worker_name "$config")
      local worker_info
      worker_info=$(get_worker_info "$config")
      local worker_type="${worker_info%%:*}"
      
      # Only scrape scraper workers, not data-api
      if [[ "$worker_type" == "scraper" ]]; then
        local pid_file="$LOG_DIR/${worker_name}.pid"
        local port=""
        
        # Check if worker is running and get its port
        if [[ -f "$pid_file" ]]; then
          local pid
          pid=$(cat "$pid_file")
          if kill -0 "$pid" 2>/dev/null; then
            # Try to find port from worker arrays or scan
            port=${worker_ports[$worker_name]:-""}
            
            # If port not in array, try to find it by scanning
            if [[ -z "$port" ]]; then
              # Look for port in log file
              if [[ -f "$LOG_DIR/${worker_name}.log" ]]; then
                port=$(grep -o "localhost:[0-9]*" "$LOG_DIR/${worker_name}.log" | head -1 | cut -d: -f2)
              fi
            fi
            
            if [[ -n "$port" ]] && nc -z localhost "$port" 2>/dev/null; then
              local emoji
              emoji=$(get_worker_emoji "$worker_name")
              echo -n "  $emoji Triggering $worker_name (port $port) ... "
              
              local response
              if response=$(curl -s -f -X POST "http://localhost:$port/" 2>/dev/null); then
                echo -e "${GREEN}✅${NC}"
                if [[ "$VERBOSE" == "true" ]]; then
                  echo "    Response: $response"
                fi
                scraped_any=true
              else
                echo -e "${RED}❌${NC}"
                failed_scrapers+=("$worker_name")
              fi
            else
              log_warning "$worker_name: Could not determine port or not responding"
              failed_scrapers+=("$worker_name")
            fi
          else
            log_warning "$worker_name: PID file exists but process not running"
            failed_scrapers+=("$worker_name")
          fi
        else
          log_warning "$worker_name: Not running (no PID file)"
          failed_scrapers+=("$worker_name")
        fi
      fi
    fi
  done
  
  echo ""
  if [[ "$scraped_any" == "true" ]]; then
    log_success "Scraping triggered successfully"
    if [[ ${#failed_scrapers[@]} -gt 0 ]]; then
      log_warning "Failed scrapers: ${failed_scrapers[*]}"
    fi
  else
    log_error "No scrapers were triggered successfully"
    if [[ ${#failed_scrapers[@]} -gt 0 ]]; then
      log_error "Failed scrapers: ${failed_scrapers[*]}"
    fi
  fi
  
  echo ""
  log_info "💡 Check individual scraper logs for detailed results:"
  for config in wrangler*.toml; do
    if [[ -f "$config" ]] && should_include_config "$config"; then
      local worker_name
      worker_name=$(get_worker_name "$config")
      local worker_info
      worker_info=$(get_worker_info "$config")
      local worker_type="${worker_info%%:*}"
      
      if [[ "$worker_type" == "scraper" ]]; then
        echo "  tail -f $LOG_DIR/${worker_name}.log"
      fi
    fi
  done
}

# Function to run tests
run_tests() {
  echo ""
  log_info "Running endpoint tests..."
  echo "================================"
  
  # Wait a bit for services to be ready
  sleep 3
  
  local data_api_port=""
  local scraper_ports=()
  local rink_ids=()
  
  # Find data API and collect rink IDs
  for worker_name in "${!worker_ports[@]}"; do
    local port=${worker_ports[$worker_name]}
    local type=${worker_types[$worker_name]}
    local rink_id=${worker_rink_ids[$worker_name]}
    
    if [[ "$type" == "data-api" ]]; then
      data_api_port=$port
    elif [[ "$type" == "scraper" && -n "$rink_id" ]]; then
      scraper_ports+=("$port:$worker_name")
      rink_ids+=("$rink_id")
    fi
  done
  
  # Test each worker
  for worker_name in "${!worker_ports[@]}"; do
    local port=${worker_ports[$worker_name]}
    
    if nc -z localhost "$port" 2>/dev/null; then
      test_worker "$worker_name" "$port"
    else
      log_error "$worker_name: Not running"
    fi
    echo ""
  done
  
  # Test comprehensive data API endpoints if available
  if [[ -n "$data_api_port" ]]; then
    test_data_api "$data_api_port"
  fi
  
  echo ""
  log_success "Tests completed"
  
  echo ""
  log_info "🎯 Manual test commands:"
  if [[ -n "$data_api_port" ]]; then
    echo "  curl http://localhost:$data_api_port/api/health"
    echo "  curl http://localhost:$data_api_port/api/all-events | jq '.[] | .rinkId' | sort | uniq"
    # Use dynamically discovered rink IDs for manual commands
    for rink_id in "${rink_ids[@]}"; do
      echo "  curl http://localhost:$data_api_port/data/$rink_id.json | jq length"
    done
  fi
  
  echo ""
  for port_worker in "${scraper_ports[@]}"; do
    local port="${port_worker%%:*}"
    local worker="${port_worker##*:}"
    local emoji
    emoji=$(get_worker_emoji "$worker")
    echo "  curl -X POST http://localhost:$port  # $emoji Trigger $worker"
  done
}

# Stop a single worker using PID file
stop_worker() {
  local worker_name="$1"
  local pid_file="$LOG_DIR/${worker_name}.pid"
  
  if [[ -f "$pid_file" ]]; then
    local pid
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      local emoji
      emoji=$(get_worker_emoji "$worker_name")
      log_info "$emoji Stopping $worker_name (PID: $pid)..."
      kill "$pid" 2>/dev/null || true
      rm -f "$pid_file"
    else
      log_warning "$worker_name not running (stale PID file)"
      rm -f "$pid_file"
    fi
  fi
}

# Cleanup function
cleanup() {
  echo ""
  log_info "Shutting down all workers..."
  
  # Stop workers using PID files (more reliable)
  for pid_file in "$LOG_DIR"/*.pid; do
    if [[ -f "$pid_file" ]]; then
      local worker_name
      worker_name=$(basename "$pid_file" .pid)
      stop_worker "$worker_name"
    fi
  done
  
  # Wait a moment for graceful shutdown
  sleep 2
  
  # Force kill any remaining processes using arrays as backup
  for worker_name in "${!worker_pids[@]}"; do
    local pid=${worker_pids[$worker_name]}
    if kill -0 "$pid" 2>/dev/null; then
      log_warning "Force killing $worker_name (PID: $pid)"
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
  
  # Clean up any remaining PID files
  rm -f "$LOG_DIR"/*.pid
  
  log_success "All workers stopped"
  log_info "📁 Logs saved in: $LOG_DIR/"
  exit 0
}

# Set up trap for cleanup (only for start command)
setup_cleanup_trap() {
  trap cleanup EXIT INT TERM
}

# Start all workers
start_all_workers() {
  # Find and validate config files
  config_files=()
  for config in wrangler*.toml; do
    if [[ -f "$config" ]]; then
      if should_include_config "$config"; then
        config_files+=("$config")
      else
        log_info "⏭️  Skipping $config (excluded by patterns)"
      fi
    fi
  done

  if [[ ${#config_files[@]} -eq 0 ]]; then
    log_error "No wrangler*.toml config files found or all excluded!"
    return 1
  fi

  log_info "Starting ${#config_files[@]} workers..."
  log_info "📁 Logs will be saved to: $LOG_DIR/"
  if [[ ${#EXCLUDE_PATTERNS[@]} -gt 0 ]]; then
    log_info "🚫 Excluding patterns: ${EXCLUDE_PATTERNS[*]}"
  fi
  if [[ ${#INCLUDE_PATTERNS[@]} -gt 0 ]]; then
    log_info "✅ Including patterns: ${INCLUDE_PATTERNS[*]}"
  fi
  echo ""

  # Start workers - prioritize data API to get PORT_START
  current_port=$PORT_START
  
  # Sort configs to ensure data API (wrangler.toml) gets first port
  sorted_configs=()
  data_api_config=""
  other_configs=()
  
  for config in "${config_files[@]}"; do
    if [[ "$(basename "$config")" == "wrangler.toml" ]]; then
      data_api_config="$config"
    else
      other_configs+=("$config")
    fi
  done
  
  # Add data API first, then others
  if [[ -n "$data_api_config" ]]; then
    sorted_configs+=("$data_api_config")
  fi
  sorted_configs+=("${other_configs[@]}")
  
  for config in "${sorted_configs[@]}"; do
    worker_name=$(get_worker_name "$config")
    worker_info=$(get_worker_info "$config")
    worker_type="${worker_info%%:*}"
    worker_rink_id="${worker_info##*:}"
    worker_emoji=$(get_worker_emoji "$worker_name")
    
    # Get available port
    available_port=$(get_available_port "$current_port")
    
    # Create log file
    log_file="$LOG_DIR/${worker_name}.log"
    
    log_info "$worker_emoji Starting $worker_name on port $available_port..."
    
    # Start worker in background with logging
    if [[ -n "$LOCAL_FLAG" ]]; then
      wrangler dev --config "$config" --port "$available_port" $LOCAL_FLAG > "$log_file" 2>&1 &
    else
      wrangler dev --config "$config" --port "$available_port" > "$log_file" 2>&1 &
    fi
    
    worker_pid=$!
    
    # Save PID to file for reliable process tracking
    echo "$worker_pid" > "$LOG_DIR/${worker_name}.pid"
    
    # Store worker info
    worker_pids["$worker_name"]=$worker_pid
    worker_ports["$worker_name"]=$available_port
    worker_types["$worker_name"]=$worker_type
    worker_rink_ids["$worker_name"]=$worker_rink_id
    
    # Increment port for next worker
    current_port=$((available_port + 1))
    
    # Small delay to stagger startup
    sleep 1
  done

  echo ""
  log_info "🌐 Service URLs:"
  echo "================"

  # Show data API first
  for worker_name in "${!worker_ports[@]}"; do
    port=${worker_ports[$worker_name]}
    type=${worker_types[$worker_name]}
    emoji=$(get_worker_emoji "$worker_name")
    
    if [[ "$type" == "data-api" ]]; then
      echo "  $emoji $worker_name: http://localhost:$port"
    fi
  done

  # Then show scrapers
  for worker_name in "${!worker_ports[@]}"; do
    port=${worker_ports[$worker_name]}
    type=${worker_types[$worker_name]}
    emoji=$(get_worker_emoji "$worker_name")
    
    if [[ "$type" == "scraper" ]]; then
      echo "  $emoji $worker_name: http://localhost:$port"
    fi
  done

  echo ""
  log_info "📋 Quick Commands:"
  echo "=================="
  echo "  tail -f $LOG_DIR/*.log     # Watch all logs"
  echo "  curl http://localhost:$PORT_START/api/health  # Test data API"
  echo ""

  if [[ "$RUN_TESTS" == "true" ]]; then
    run_tests
  fi

  if [[ "$AUTO_SCRAPE" == "true" ]]; then
    run_scrapers
  fi

  log_info "💡 Use --test flag to run endpoint tests automatically"
  log_info "💡 Use --auto-scrape flag to trigger scraping after startup"
  log_info "🛑 Press Ctrl+C to stop all workers"
  echo ""

  # Wait for all background processes
  wait
}

# Main command handling
case "$COMMAND" in
  start)
    setup_cleanup_trap
    start_all_workers
    ;;
  stop)
    stop_all_workers
    ;;
  test)
    run_tests
    ;;
  scrape)
    run_scrapers
    ;;
  restart)
    setup_cleanup_trap
    stop_all_workers
    sleep 2
    start_all_workers
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

