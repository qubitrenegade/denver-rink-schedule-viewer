#!/bin/bash

# Deployment script for Denver Rink Schedule Viewer workers
# Deploys all workers to Cloudflare using their respective wrangler configs

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CONFIGS=(
    "wrangler.toml:Data API"
    "wrangler-ice-ranch.toml:Ice Ranch Scraper"
    "wrangler-big-bear.toml:Big Bear Scraper"
    "wrangler-du-ritchie.toml:DU Ritchie Scraper"
    "wrangler-foothills-edge.toml:Foothills Edge Scraper"
    "wrangler-ssprd.toml:SSPRD Scraper"
    "wrangler-apex-ice.toml:Apex Ice Scraper"
)

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

# Usage information
show_usage() {
cat << 'EOF'
🚀 Denver Rink Schedule Viewer - Deployment Script

USAGE:
    ./scripts/deploy.sh [OPTIONS]

OPTIONS:
    --dry-run     Show what would be deployed without actually deploying
    --config FILE Deploy only specific config file
    --no-scrape   Skip triggering scrapers after deployment
    --help        Show this help message

EXAMPLES:
    # Deploy all workers and trigger scrapers
    ./scripts/deploy.sh

    # Dry run to see what would be deployed
    ./scripts/deploy.sh --dry-run

    # Deploy only the data API
    ./scripts/deploy.sh --config wrangler.toml

    # Deploy only Ice Ranch scraper
    ./scripts/deploy.sh --config wrangler-ice-ranch.toml

    # Deploy all workers but skip scraper triggering
    ./scripts/deploy.sh --no-scrape

EOF
}

# Check if wrangler is installed and authenticated
check_wrangler() {
    if ! command -v wrangler &> /dev/null; then
        log_error "Wrangler CLI not found. Please install it first:"
        echo "  npm install -g wrangler"
        exit 1
    fi
    
    # Check if authenticated
    if ! wrangler whoami &> /dev/null; then
        log_error "Not authenticated with Cloudflare. Please run:"
        echo "  wrangler login"
        exit 1
    fi
    
    log_info "Wrangler authenticated as: $(wrangler whoami 2>/dev/null | head -1)"
}

# Deploy a single worker
deploy_worker() {
    local config=$1
    local description=$2
    local dry_run=${3:-false}
    
    if [[ ! -f "$config" ]]; then
        log_error "Config file not found: $config"
        return 1
    fi
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Would deploy: $description ($config)"
        return 0
    fi
    
    log_info "Deploying $description..."
    echo "  Config: $config"
    
    if wrangler deploy --config "$config"; then
        log_success "$description deployed successfully"
    else
        log_error "Failed to deploy $description"
        return 1
    fi
    
    echo ""
}

# Trigger all scrapers after deployment
trigger_scrapers() {
    local dry_run=${1:-false}
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "Would trigger all scrapers to refresh data"
        return 0
    fi
    
    log_info "Triggering scrapers to refresh data..."
    echo ""
    
    # Scraper endpoints
    local scrapers=(
        "ssprd:https://rink-scraper-ssprd.qbrd.workers.dev"
        "foothills-edge:https://rink-scraper-foothills-edge.qbrd.workers.dev"
        "ice-ranch:https://rink-scraper-ice-ranch.qbrd.workers.dev"
        "big-bear:https://rink-scraper-big-bear.qbrd.workers.dev"
        "du-ritchie:https://rink-scraper-du-ritchie.qbrd.workers.dev"
        "apex-ice:https://rink-scraper-apex-ice.qbrd.workers.dev"
    )
    
    local failed_scrapers=()
    local successful_scrapers=()
    
    for scraper_def in "${scrapers[@]}"; do
        IFS=':' read -r name url <<< "$scraper_def"
        
        echo -n "  Triggering $name scraper... "
        
        if response=$(curl -s -X POST "$url" --max-time 30 2>/dev/null); then
            if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
                event_count=$(echo "$response" | jq -r '.eventCount // "N/A"')
                echo -e "${GREEN}✅ Success${NC} ($event_count events)"
                successful_scrapers+=("$name")
            else
                echo -e "${RED}❌ Failed${NC} (scraper returned error)"
                failed_scrapers+=("$name")
            fi
        else
            echo -e "${RED}❌ Failed${NC} (connection error)"
            failed_scrapers+=("$name")
        fi
    done
    
    echo ""
    
    # Summary
    if [[ ${#successful_scrapers[@]} -gt 0 ]]; then
        log_success "Successfully triggered ${#successful_scrapers[@]} scrapers"
    fi
    
    if [[ ${#failed_scrapers[@]} -gt 0 ]]; then
        log_warning "Failed to trigger ${#failed_scrapers[@]} scrapers: ${failed_scrapers[*]}"
        echo "  You may need to trigger these manually or check their status"
    fi
    
    echo ""
}

# Deploy all workers
deploy_all() {
    local dry_run=${1:-false}
    local skip_scrape=${2:-false}
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "DRY RUN - No actual deployments will occur"
        echo ""
    fi
    
    local failed_deployments=()
    local successful_deployments=()
    
    for config_def in "${CONFIGS[@]}"; do
        IFS=':' read -r config description <<< "$config_def"
        
        if deploy_worker "$config" "$description" "$dry_run"; then
            successful_deployments+=("$description")
        else
            failed_deployments+=("$description")
        fi
    done
    
    # Summary
    echo "🏁 Deployment Summary:"
    echo "====================="
    
    if [[ ${#successful_deployments[@]} -gt 0 ]]; then
        echo -e "${GREEN}✅ Successful deployments:${NC}"
        for deployment in "${successful_deployments[@]}"; do
            echo "  - $deployment"
        done
    fi
    
    if [[ ${#failed_deployments[@]} -gt 0 ]]; then
        echo -e "${RED}❌ Failed deployments:${NC}"
        for deployment in "${failed_deployments[@]}"; do
            echo "  - $deployment"
        done
        echo ""
        log_error "Some deployments failed. Check the output above for details."
        exit 1
    fi
    
    if [[ "$dry_run" != "true" ]]; then
        log_success "All workers deployed successfully!"
        echo ""
        echo "🌐 Your workers are now live on Cloudflare Edge!"
        echo "   Check your Cloudflare dashboard for URLs and status."
        echo ""
        
        # Trigger scrapers unless explicitly skipped
        if [[ "$skip_scrape" != "true" ]]; then
            trigger_scrapers "$dry_run"
        else
            log_info "Skipping scraper triggering (--no-scrape flag used)"
            echo ""
        fi
    fi
}

# Parse command line arguments
DRY_RUN=false
SINGLE_CONFIG=""
SKIP_SCRAPE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --config)
            SINGLE_CONFIG="$2"
            shift 2
            ;;
        --no-scrape)
            SKIP_SCRAPE=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo ""
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
echo "🚀 Denver Rink Schedule Viewer - Deployment"
echo "============================================"
echo ""

# Check prerequisites
check_wrangler
echo ""

# Deploy
if [[ -n "$SINGLE_CONFIG" ]]; then
    # Deploy single config
    description="Custom Worker"
    for config_def in "${CONFIGS[@]}"; do
        IFS=':' read -r config desc <<< "$config_def"
        if [[ "$config" == "$SINGLE_CONFIG" ]]; then
            description="$desc"
            break
        fi
    done
    
    deploy_worker "$SINGLE_CONFIG" "$description" "$DRY_RUN"
else
    # Deploy all
    deploy_all "$DRY_RUN" "$SKIP_SCRAPE"
fi
