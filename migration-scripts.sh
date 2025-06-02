#!/bin/bash
# Migration and testing scripts for CloudFlare Workers

# deploy-workers.sh - Deploy all workers
deploy_workers() {
  echo "🚀 Deploying all rink scraper workers..."
  
  # Check for wrangler in common locations
  if ! command -v wrangler &> /dev/null; then
    # Try bun global path
    if [[ -f "/home/$USER/.bun/bin/wrangler" ]]; then
      export PATH="/home/$USER/.bun/bin:$PATH"
      echo "✅ Found wrangler in bun global path"
    else
      echo "❌ Wrangler CLI not found. Install with: bun install -g wrangler"
      echo "💡 You may need to add bun to PATH: export PATH=\"/home/$USER/.bun/bin:\$PATH\""
      exit 1
    fi
  fi
  
  # Deploy data API first
  echo "📡 Deploying data API worker..."
  if ! wrangler deploy --config wrangler.toml; then
    echo "❌ Failed to deploy data API worker"
    exit 1
  fi
  
  # Deploy all scrapers
  configs=(
    "wrangler-ice-ranch.toml"
    "wrangler-big-bear.toml" 
    "wrangler-du-ritchie.toml"
    "wrangler-foothills-edge.toml"
    "wrangler-ssprd.toml"
  )
  
  for config in "${configs[@]}"; do
    if [[ -f "$config" ]]; then
      echo "🔧 Deploying $config..."
      if ! wrangler deploy --config "$config"; then
        echo "⚠️ Failed to deploy $config, continuing..."
      fi
    else
      echo "⚠️ Config file $config not found, skipping..."
    fi
  done
  
  echo "✅ Worker deployment completed!"
  echo "🌐 Data API should be available at: https://rink-data-api.your-subdomain.workers.dev"
  echo "🔍 Test with: curl https://rink-data-api.your-subdomain.workers.dev/api/health"
}

# test-workers.sh - Test all workers
test_workers() {
  echo "🧪 Testing all deployed workers..."
  
  # Test data API
  echo "📡 Testing data API worker..."
  API_URL="https://rink-data-api.your-subdomain.workers.dev"
  
  if curl -s "$API_URL/api/health" | grep -q "ok"; then
    echo "✅ Data API is responding"
  else
    echo "❌ Data API is not responding correctly"
  fi
  
  # Test each scraper by triggering manually
  scrapers=(
    "rink-scraper-ice-ranch"
    "rink-scraper-big-bear"
    "rink-scraper-du-ritchie" 
    "rink-scraper-foothills-edge"
    "rink-scraper-ssprd"
  )
  
  for scraper in "${scrapers[@]}"; do
    echo "🔧 Testing $scraper..."
    SCRAPER_URL="https://$scraper.your-subdomain.workers.dev"
    
    if curl -s -X POST "$SCRAPER_URL" | grep -q "success"; then
      echo "✅ $scraper is working"
    else
      echo "⚠️ $scraper might not be working (check logs)"
    fi
  done
  
  echo "🔍 Check data availability..."
  sleep 10 # Wait for scrapers to complete
  
  if curl -s "$API_URL/api/all-events" | jq length > /dev/null 2>&1; then
    EVENT_COUNT=$(curl -s "$API_URL/api/all-events" | jq length)
    echo "✅ Found $EVENT_COUNT events in KV storage"
  else
    echo "❌ No events found or API error"
  fi
}

# migrate-from-github.sh - Help migrate from GitHub Actions
migrate_from_github() {
  echo "🔄 Migrating from GitHub Actions to CloudFlare Workers..."
  
  # Create backup of current data
  if [[ -d "public/data" ]]; then
    echo "💾 Creating backup of current data..."
    cp -r public/data public/data-backup-$(date +%Y%m%d)
    echo "✅ Backup created"
  fi
  
  # Disable GitHub Actions
  if [[ -d ".github/workflows" ]]; then
    echo "🚫 Disabling GitHub Actions..."
    mkdir -p .github/workflows-disabled
    mv .github/workflows/*.yml .github/workflows-disabled/ 2>/dev/null || true
    echo "✅ GitHub Actions workflows moved to .github/workflows-disabled/"
  fi
  
  # Update .gitignore
  echo "📝 Updating .gitignore..."
  if ! grep -q "public/data/\*.json" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# Data files now stored in CloudFlare KV" >> .gitignore
    echo "public/data/*.json" >> .gitignore
    echo "✅ Updated .gitignore"
  fi
  
  echo "🎯 Migration preparation complete!"
  echo "📋 Next steps:"
  echo "   1. Deploy workers: ./deploy-workers.sh"
  echo "   2. Test workers: ./test-workers.sh"
  echo "   3. Update frontend code with new API endpoints"
  echo "   4. Remove public/data/*.json files after testing"
}

# setup-kv.sh - Help with KV namespace setup
setup_kv() {
  echo "🗄️ Setting up CloudFlare KV namespace..."
  
  # Check for wrangler in common locations
  if ! command -v wrangler &> /dev/null; then
    # Try bun global path
    if [[ -f "/home/$USER/.bun/bin/wrangler" ]]; then
      export PATH="/home/$USER/.bun/bin:$PATH"
      echo "✅ Found wrangler in bun global path"
    else
      echo "❌ Wrangler CLI not found. Install with: bun install -g wrangler"
      echo "💡 You may need to add bun to PATH: export PATH=\"/home/$USER/.bun/bin:\$PATH\""
      exit 1
    fi
  fi
  
  echo "🔐 Logging into CloudFlare..."
  wrangler login
  
  echo "📦 Creating KV namespace for production..."
  PROD_OUTPUT=$(wrangler kv namespace create "RINK_DATA" 2>&1)
  echo "$PROD_OUTPUT"
  
  echo "🧪 Creating KV namespace for preview..."
  PREVIEW_OUTPUT=$(wrangler kv namespace create "RINK_DATA" --preview 2>&1)
  echo "$PREVIEW_OUTPUT"
  
  echo ""
  echo "✅ KV namespace creation attempted!"
  echo "📝 Copy the IDs from above and update all wrangler*.toml files"
  echo "🔧 Update this section in each wrangler config:"
  echo ""
  echo "[[kv_namespaces]]"
  echo "binding = \"RINK_DATA\""
  echo "id = \"your_production_id_here\""
  echo "preview_id = \"your_preview_id_here\""
  echo ""
  echo "💡 If the commands failed, try manually:"
  echo "   wrangler kv namespace create RINK_DATA"
  echo "   wrangler kv namespace create RINK_DATA --preview"
}

# monitor-workers.sh - Monitor worker status and logs
monitor_workers() {
  echo "📊 Monitoring worker status..."
  
  # Check for wrangler in common locations
  if ! command -v wrangler &> /dev/null; then
    # Try bun global path
    if [[ -f "/home/$USER/.bun/bin/wrangler" ]]; then
      export PATH="/home/$USER/.bun/bin:$PATH"
      echo "✅ Found wrangler in bun global path"
    else
      echo "❌ Wrangler CLI not found. Install with: bun install -g wrangler"
      echo "💡 You may need to add bun to PATH: export PATH=\"/home/$USER/.bun/bin:\$PATH\""
      exit 1
    fi
  fi
  
  # Check data API health
  API_URL="https://rink-data-api.your-subdomain.workers.dev"
  echo "🌐 Checking data API health..."
  curl -s "$API_URL/api/health" | jq '.' || echo "❌ API not responding"
  
  echo ""
  echo "📈 Recent worker activity (press Ctrl+C to stop):"
  echo "Choose a worker to monitor:"
  echo "1) Data API"
  echo "2) Ice Ranch scraper"  
  echo "3) Big Bear scraper"
  echo "4) DU Ritchie scraper"
  echo "5) Foothills Edge scraper"
  echo "6) SSPRD scraper"
  
  read -p "Enter choice (1-6): " choice
  
  case $choice in
    1) wrangler tail rink-data-api ;;
    2) wrangler tail rink-scraper-ice-ranch ;;
    3) wrangler tail rink-scraper-big-bear ;;
    4) wrangler tail rink-scraper-du-ritchie ;;
    5) wrangler tail rink-scraper-foothills-edge ;;
    6) wrangler tail rink-scraper-ssprd ;;
    *) echo "Invalid choice" ;;
  esac
}

# Main script dispatcher
case "${1:-help}" in
  "deploy")
    deploy_workers
    ;;
  "test")
    test_workers
    ;;
  "migrate")
    migrate_from_github
    ;;
  "setup-kv")
    setup_kv
    ;;
  "monitor")
    monitor_workers
    ;;
  "help"|*)
    echo "🏒 Denver Rink Schedule - CloudFlare Workers Management"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  setup-kv   - Create CloudFlare KV namespaces"
    echo "  deploy     - Deploy all workers"
    echo "  test       - Test all deployed workers"
    echo "  migrate    - Migrate from GitHub Actions"
    echo "  monitor    - Monitor worker logs and status"
    echo "  help       - Show this help message"
    echo ""
    echo "Example workflow:"
    echo "  $0 setup-kv     # First time setup"
    echo "  $0 migrate      # Prepare migration"
    echo "  $0 deploy       # Deploy workers"
    echo "  $0 test         # Test everything works"
    echo "  $0 monitor      # Monitor ongoing operation"
    ;;
esac
