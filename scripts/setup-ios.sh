#!/bin/bash

# iOS Development Setup Script
# Sets up the development environment for iOS app development

set -e

echo "🍎 Denver Rink Schedule iOS Development Setup"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. iOS development requires macOS."
    exit 1
fi

print_status "Checking prerequisites..."

# Check if Xcode is installed
if ! command -v xcodebuild &> /dev/null; then
    print_error "Xcode is not installed. Please install Xcode from the Mac App Store."
    exit 1
fi

print_success "Xcode is installed"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js is installed ($NODE_VERSION)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install Node.js which includes npm."
    exit 1
fi

NPM_VERSION=$(npm --version)
print_success "npm is installed ($NPM_VERSION)"

# Check if CocoaPods is installed
if ! command -v pod &> /dev/null; then
    print_warning "CocoaPods is not installed. Installing..."
    sudo gem install cocoapods
    print_success "CocoaPods installed"
else
    POD_VERSION=$(pod --version)
    print_success "CocoaPods is installed ($POD_VERSION)"
fi

print_status "Installing npm dependencies..."
npm install

print_status "Building web app..."
npm run build

print_status "Syncing Capacitor..."
npm run cap:sync

print_status "Setting up iOS project..."
cd ios/App

# Install iOS dependencies
if [ -f "Podfile" ]; then
    print_status "Installing iOS dependencies with CocoaPods..."
    pod install
    print_success "iOS dependencies installed"
else
    print_warning "No Podfile found. iOS dependencies may not be properly configured."
fi

cd ../..

print_success "iOS development setup complete!"
print_status "Next steps:"
echo "  1. Open the iOS project: npm run ios:open"
echo "  2. Select a simulator or device in Xcode"
echo "  3. Click the Run button (▶️) to build and run the app"
echo ""
print_status "For more information, see docs/ios-development.md"

# Check for Apple Developer account
print_status "Don't forget to configure your Apple Developer account in Xcode:"
echo "  1. Xcode → Preferences → Accounts"
echo "  2. Add your Apple ID"
echo "  3. Download provisioning profiles"
echo "  4. Set up code signing in the project settings"
echo ""

print_status "For App Store deployment, you'll need to set up:"
echo "  1. App Store Connect account"
echo "  2. Distribution certificates"
echo "  3. App Store provisioning profiles"
echo "  4. GitHub repository secrets for CI/CD"
echo ""

print_success "Setup complete! Happy iOS development! 🚀"