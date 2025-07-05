# iOS App Development Guide

This guide covers the development, building, and deployment of the Denver Rink Schedule iOS app using Capacitor.

## Overview

The iOS app is built using Capacitor, which wraps the existing React PWA in a native iOS container. This approach allows us to:

- Reuse the existing React codebase with minimal changes
- Access native iOS features through Capacitor plugins
- Maintain consistency with the web app
- Deploy to the App Store

## Prerequisites

### Development Environment

1. **macOS** (required for iOS development)
2. **Xcode 15.4+** (available from the Mac App Store)
3. **Node.js 18+** and npm
4. **CocoaPods** (`sudo gem install cocoapods`)
5. **iOS Developer Account** (for App Store deployment)

### Apple Developer Setup

1. **Apple Developer Account**: Sign up at [developer.apple.com](https://developer.apple.com)
2. **Bundle ID**: `com.geticetime.denverrinkschedule`
3. **Certificates**: Create development and distribution certificates
4. **Provisioning Profiles**: Create profiles for development and distribution

## Development Workflow

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/qubitrenegade/denver-rink-schedule-viewer.git
cd denver-rink-schedule-viewer

# Install dependencies
npm install

# Build the web app
npm run build

# Sync Capacitor
npx cap sync ios
```

### Development Commands

```bash
# Build web app and sync to iOS
npm run ios:build

# Open in Xcode
npm run ios:open

# Complete build and open workflow
npm run ios:run

# Sync only (after making changes)
npx cap sync ios
```

### Making Changes

1. **Web App Changes**: Edit React components in `src/`
2. **iOS-Specific Changes**: Edit native iOS code in `ios/App/App/`
3. **Capacitor Configuration**: Edit `capacitor.config.ts`
4. **Native Features**: Add plugins and configure in `src/capacitor/`

### Testing

#### On iOS Simulator

1. Run `npm run ios:open`
2. Select a simulator in Xcode
3. Click Run (▶️) button

#### On Physical Device

1. Connect iOS device via USB
2. Trust the device in Xcode
3. Select your device as the destination
4. Click Run (▶️) button

### Common Development Tasks

#### Adding New Capacitor Plugins

```bash
# Install plugin
npm install @capacitor/camera

# Sync to iOS
npx cap sync ios

# Add to src/capacitor/index.ts
import { Camera } from '@capacitor/camera';
```

#### Updating App Icons

1. Replace icons in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
2. Use Xcode's icon generator or create manually
3. Ensure all required sizes are present

#### Configuring Permissions

Edit `ios/App/App/Info.plist` to add usage descriptions:

```xml
<key>NSCameraUsageDescription</key>
<string>This app uses the camera to scan QR codes.</string>
```

## Build and Deployment

### Local Build

```bash
# Build for development
npm run ios:build

# Build for release (in Xcode)
# 1. Open Xcode
# 2. Select "Any iOS Device" as destination
# 3. Product → Archive
```

### CI/CD Pipeline

The project includes a GitHub Actions workflow for automated builds:

#### Triggers

- **Push to main**: Builds the app
- **Pull Request**: Builds the app for testing
- **Manual Dispatch**: Allows deployment to TestFlight/App Store

#### Secrets Required

Set these in GitHub repository settings:

- `APPLE_ID`: Your Apple ID email
- `APPLE_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Your Apple Developer Team ID

#### Manual Deployment

1. Go to GitHub Actions
2. Select "iOS Build and Deploy"
3. Click "Run workflow"
4. Choose deployment options:
   - TestFlight: For beta testing
   - App Store: For production release

### TestFlight Deployment

1. **Automatic**: Use GitHub Actions workflow
2. **Manual**: Upload via Xcode or Application Loader
3. **Beta Testing**: Invite testers through App Store Connect

### App Store Deployment

1. **Upload**: Via GitHub Actions or Xcode
2. **Review**: Submit for App Store review
3. **Release**: Approve for release after review

## Configuration

### App Metadata

- **App Name**: Denver Rink Schedule
- **Bundle ID**: com.geticetime.denverrinkschedule
- **Category**: Sports
- **Target iOS Version**: 13.0+

### Capacitor Configuration

Key settings in `capacitor.config.ts`:

```typescript
{
  appId: 'com.geticetime.denverrinkschedule',
  appName: 'Denver Rink Schedule',
  webDir: 'dist',
  ios: {
    scheme: 'Denver Rink Schedule',
    contentInset: 'automatic',
    backgroundColor: '#ffffff'
  }
}
```

### Native Features

#### Implemented Features

- **Status Bar**: Customized appearance
- **Splash Screen**: Branded loading screen
- **Haptic Feedback**: Touch feedback for interactions
- **Native Sharing**: iOS share sheet integration
- **Deep Links**: URL scheme support
- **Background Updates**: Background fetch capability

#### Available Plugins

- `@capacitor/app`: App lifecycle and deep links
- `@capacitor/status-bar`: Status bar customization
- `@capacitor/splash-screen`: Splash screen management
- `@capacitor/keyboard`: Keyboard behavior
- `@capacitor/haptics`: Haptic feedback
- `@capacitor/share`: Native sharing

## Troubleshooting

### Common Issues

#### Build Errors

1. **"No matching provisioning profiles found"**
   - Solution: Create/update provisioning profiles in Apple Developer portal

2. **"Code signing error"**
   - Solution: Ensure certificates are installed in Keychain

3. **"CocoaPods not found"**
   - Solution: `sudo gem install cocoapods`

#### Runtime Issues

1. **White screen on startup**
   - Check console for JavaScript errors
   - Verify web app builds successfully

2. **Network requests fail**
   - Check `NSAppTransportSecurity` settings in Info.plist
   - Verify CORS configuration

3. **Plugins not working**
   - Ensure plugins are properly installed
   - Check iOS permissions in Info.plist

### Debugging

#### Web Inspector

1. Open Safari on Mac
2. Connect iOS device
3. Develop → Device → Select App
4. Use web inspector to debug

#### Xcode Console

1. Open Xcode
2. Window → Devices and Simulators
3. Select device
4. View console output

## App Store Guidelines

### Key Requirements

1. **Functionality**: App must provide meaningful functionality
2. **Performance**: Must be stable and performant
3. **Design**: Follow iOS Human Interface Guidelines
4. **Content**: Appropriate for all audiences
5. **Privacy**: Include privacy policy if collecting data

### Review Process

1. **Submission**: Upload through App Store Connect
2. **Review**: Apple reviews app (1-7 days typically)
3. **Feedback**: Address any issues if rejected
4. **Approval**: App becomes available on App Store

### Marketing Materials

Required for App Store:

- App screenshots (multiple sizes)
- App description
- Keywords
- App icon (1024x1024)
- Privacy policy URL (if applicable)

## Future Enhancements

### Potential Features

1. **Push Notifications**: Alert users of schedule changes
2. **Offline Maps**: Show rink locations
3. **Calendar Integration**: Add events to device calendar
4. **Favorites**: Save favorite rinks
5. **Apple Watch**: Companion watch app

### Technical Improvements

1. **App Clips**: Lightweight app experiences
2. **Widgets**: Home screen widgets
3. **Shortcuts**: Siri shortcuts integration
4. **Background Processing**: Enhanced background updates

## Support

For issues or questions:

1. Check the [Capacitor documentation](https://capacitorjs.com/docs)
2. Review [Apple Developer documentation](https://developer.apple.com/documentation/)
3. Open an issue in the GitHub repository
4. Contact the development team

## Links

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Apple Developer Portal](https://developer.apple.com)
- [App Store Connect](https://appstoreconnect.apple.com)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/ios/)