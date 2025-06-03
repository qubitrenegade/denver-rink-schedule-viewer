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

# Parse command line arguments
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
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --port-start PORT    Starting port number (default: 8787)"
      echo "  --exclude PATTERN    Exclude configs matching pattern (can be used multiple times)"
      echo "  --include PATTERN    Only include configs matching pattern (can be used multiple times)"
      echo "  --remote             Run against remote Cloudflare (no --local)"
      echo "  --test               Run tests after startup"
      echo "  --help               Show this help"
      echo ""
      echo "Usage Examples:"
      echo "  # Basic usage"
      echo "  ./scripts/dev-workers.sh"
      echo ""
      echo "  # Start from port 9000"
      echo "  ./scripts/dev-workers.sh --port-start 9000"
      echo ""
      echo "  # Skip big-bear worker"
      echo "  ./scripts/dev-workers.sh --exclude \"big-bear\""
      echo ""
      echo "  # Run tests automatically after startup"
      echo "  ./scripts/dev-workers.sh --test"
      echo ""
      echo "  # Run against remote Cloudflare"
      echo "  ./scripts/dev-workers.sh --remote"
      echo ""
      echo "  # Advanced usage"
      echo "  ./scripts/dev-workers.sh --port-start 8800 --exclude \"ssprd\" --exclude \"big-bear\" --test"
      echo ""
      echo "  # Only include specific workers"
      echo "  ./scripts/dev-workers.sh --include \"data-api\" --include \"ice-ranch\" --test"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Create logs directory
mkdir -p "$LOG_DIR"

# Array to store process info
declare -A worker_pids
declare -A worker_ports
declare -A worker_names
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
  local name=$(grep "^name = " "$config_file" 2>/dev/null | sed 's/name = "\(.*\)"/\1/')
  echo "${name:-$(basename "$config_file" .toml)}"
}

# Function to determine worker type and extract rink ID
get_worker_info() {
  local config_file="$1"
  local name=$(basename "$config_file" .toml)
  
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

# Function to run tests
run_tests() {
  echo ""
  echo "🧪 Running endpoint tests..."
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
  
  # Test Data API endpoints
  if [[ -n "$data_api_port" ]]; then
    echo "📊 Testing Data API (port $data_api_port):"
    
    echo -n "  GET /api/health ... "
    if curl -s "http://localhost:$data_api_port/api/health" >/dev/null; then
      echo "✅"
    else
      echo "❌"
    fi
    
    echo -n "  GET /api/all-metadata ... "
    if curl -s "http://localhost:$data_api_port/api/all-metadata" >/dev/null; then
      echo "✅"
    else
      echo "❌"
    fi
    
    echo -n "  GET /api/all-events ... "
    if curl -s "http://localhost:$data_api_port/api/all-events" >/dev/null; then
      echo "✅"
    else
      echo "❌"
    fi
    
    # Test individual rink endpoints dynamically
    echo "  Testing individual rink endpoints:"
    for rink_id in "${rink_ids[@]}"; do
      echo -n "    GET /data/$rink_id.json ... "
      if curl -s "http://localhost:$data_api_port/data/$rink_id.json" >/dev/null; then
        echo "✅"
      else
        echo "❌"
      fi
      
      echo -n "    GET /data/$rink_id-metadata.json ... "
      if curl -s "http://localhost:$data_api_port/data/$rink_id-metadata.json" >/dev/null; then
        echo "✅"
      else
        echo "❌"
      fi
    done
  fi
  
  # Test scraper endpoints
  echo ""
  echo "🔧 Testing Scrapers:"
  for port_worker in "${scraper_ports[@]}"; do
    local port="${port_worker%%:*}"
    local worker="${port_worker##*:}"
    local emoji=$(get_worker_emoji "$worker")
    
    echo -n "  $emoji $worker (port $port) POST / ... "
    if response=$(curl -s -X POST "http://localhost:$port" 2>/dev/null); then
      if echo "$response" | grep -q "success\|Successfully\|completed"; then
        echo "✅"
      else
        echo "⚠️  (responded but unclear success)"
      fi
    else
      echo "❌"
    fi
  done
  
  echo ""
  echo "🎯 Manual test commands:"
  if [[ -n "$data_api_port" ]]; then
    echo "  curl http://localhost:$data_api_port/api/health"
    echo "  curl http://localhost:$data_api_port/api/all-events | jq '.[] | .rinkId' | sort | uniq"
    for rink_id in "${rink_ids[@]}"; do
      echo "  curl http://localhost:$data_api_port/data/$rink_id.json | jq length"
    done
  fi
  
  echo ""
  for port_worker in "${scraper_ports[@]}"; do
    local port="${port_worker%%:*}"
    local worker="${port_worker##*:}"
    local emoji=$(get_worker_emoji "$worker")
    echo "  curl -X POST http://localhost:$port  # $emoji Trigger $worker"
  done
}

# Cleanup function
cleanup() {
  echo ""
  echo "🛑 Shutting down all workers..."
  for worker_name in "${!worker_pids[@]}"; do
    local pid=${worker_pids[$worker_name]}
    local port=${worker_ports[$worker_name]}
    local emoji=$(get_worker_emoji "$worker_name")
    echo "  $emoji Stopping $worker_name (PID: $pid, Port: $port)"
    kill "$pid" 2>/dev/null || true
  done
  
  # Wait a moment for graceful shutdown
  sleep 2
  
  # Force kill any remaining processes
  for worker_name in "${!worker_pids[@]}"; do
    local pid=${worker_pids[$worker_name]}
    kill -9 "$pid" 2>/dev/null || true
  done
  
  echo "✅ All workers stopped"
  echo "📁 Logs saved in: $LOG_DIR/"
  exit 0
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Find and validate config files
config_files=()
for config in wrangler*.toml; do
  if [[ -f "$config" ]]; then
    if should_include_config "$config"; then
      config_files+=("$config")
    else
      echo "⏭️  Skipping $config (excluded by patterns)"
    fi
  fi
done

if [[ ${#config_files[@]} -eq 0 ]]; then
  echo "❌ No wrangler*.toml config files found or all excluded!"
  exit 1
fi

echo "🚀 Starting ${#config_files[@]} workers..."
echo "📁 Logs will be saved to: $LOG_DIR/"
if [[ ${#EXCLUDE_PATTERNS[@]} -gt 0 ]]; then
  echo "🚫 Excluding patterns: ${EXCLUDE_PATTERNS[*]}"
fi
if [[ ${#INCLUDE_PATTERNS[@]} -gt 0 ]]; then
  echo "✅ Including patterns: ${INCLUDE_PATTERNS[*]}"
fi
echo ""

# Start workers
current_port=$PORT_START
for config in "${config_files[@]}"; do
  worker_name=$(get_worker_name "$config")
  worker_info=$(get_worker_info "$config")
  worker_type="${worker_info%%:*}"
  worker_rink_id="${worker_info##*:}"
  worker_emoji=$(get_worker_emoji "$worker_name")
  
  # Get available port
  available_port=$(get_available_port $current_port)
  
  # Create log file
  log_file="$LOG_DIR/${worker_name}.log"
  
  echo "$worker_emoji Starting $worker_name on port $available_port..."
  
  # Start worker in background with logging
  if [[ -n "$LOCAL_FLAG" ]]; then
    wrangler dev --config "$config" --port "$available_port" $LOCAL_FLAG > "$log_file" 2>&1 &
  else
    wrangler dev --config "$config" --port "$available_port" > "$log_file" 2>&1 &
  fi
  
  worker_pid=$!
  
  # Store worker info
  worker_pids["$worker_name"]=$worker_pid
  worker_ports["$worker_name"]=$available_port
  worker_names["$worker_name"]=$worker_name
  worker_types["$worker_name"]=$worker_type
  worker_rink_ids["$worker_name"]=$worker_rink_id
  
  # Increment port for next worker
  current_port=$((available_port + 1))
  
  # Small delay to stagger startup
  sleep 1
done

echo ""
echo "🌐 Service URLs:"
echo "================"

# Show data API first
for worker_name in "${!worker_ports[@]}"; do
  local port=${worker_ports[$worker_name]}
  local type=${worker_types[$worker_name]}
  local emoji=$(get_worker_emoji "$worker_name")
  
  if [[ "$type" == "data-api" ]]; then
    echo "  $emoji $worker_name: http://localhost:$port"
  fi
done

# Then show scrapers
for worker_name in "${!worker_ports[@]}"; do
  local port=${worker_ports[$worker_name]}
  local type=${worker_types[$worker_name]}
  local emoji=$(get_worker_emoji "$worker_name")
  
  if [[ "$type" == "scraper" ]]; then
    echo "  $emoji $worker_name: http://localhost:$port"
  fi
done

echo ""
echo "📋 Quick Commands:"
echo "=================="
echo "  tail -f $LOG_DIR/*.log     # Watch all logs"
echo "  curl http://localhost:$PORT_START/api/health  # Test data API"
echo ""

if [[ "$RUN_TESTS" == "true" ]]; then
  run_tests
fi

echo "💡 Use --test flag to run endpoint tests automatically"
echo "🛑 Press Ctrl+C to stop all workers"
echo ""

# Wait for all background processes
wait

