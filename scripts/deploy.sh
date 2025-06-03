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
    --help        Show this help message

EXAMPLES:
    # Deploy all workers
    ./scripts/deploy.sh

    # Dry run to see what would be deployed
    ./scripts/deploy.sh --dry-run

    # Deploy only the data API
    ./scripts/deploy.sh --config wrangler.toml

    # Deploy only Ice Ranch scraper
    ./scripts/deploy.sh --config wrangler-ice-ranch.toml

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

# Deploy all workers
deploy_all() {
    local dry_run=${1:-false}
    
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
    fi
}

# Parse command line arguments
DRY_RUN=false
SINGLE_CONFIG=""

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
    deploy_all "$DRY_RUN"
fi
