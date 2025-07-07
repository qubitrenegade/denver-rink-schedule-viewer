# Android App Development Guide

This document provides comprehensive instructions for developing, building, and deploying the Android version of the Denver Rink Schedule Viewer.

## Overview

The Android app is built using Capacitor, which wraps the existing PWA (Progressive Web App) in a native Android container. This approach allows us to:

- Leverage the existing React frontend and Cloudflare Workers APIs
- Maintain all PWA features (offline support, caching, etc.)
- Provide a native Android app experience
- Distribute through Google Play Store

## Prerequisites

### Development Environment

1. **Node.js** (v18 or higher)
2. **Android Studio** with Android SDK
3. **Java Development Kit (JDK) 17**
4. **Android SDK** with API level 33 or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/qubitrenegade/denver-rink-schedule-viewer.git
cd denver-rink-schedule-viewer

# Install dependencies
npm install

# Build the web app
npm run build

# Sync with Android project
npx cap sync android
```

## Development Workflow

### 1. Local Development

```bash
# Start the web development server
npm run dev

# In another terminal, run the Android app
npm run cap:android
```

### 2. Building for Android

```bash
# Build web app and sync to Android
npm run cap:build

# Build Android APK
cd android
./gradlew assembleDebug
```

### 3. Testing

```bash
# Run web tests
npm run test

# Run critical tests
npm run test:critical

# Build and test Android app
npm run cap:build
cd android
./gradlew connectedAndroidTest
```

## Project Structure

```
├── src/                          # React frontend source
├── public/                       # Static assets
├── android/                      # Android project files
│   ├── app/                      # Main Android app
│   │   ├── src/main/            # Android source code
│   │   └── build.gradle         # Android build configuration
│   └── build.gradle             # Project-level build configuration
├── capacitor.config.ts          # Capacitor configuration
├── resources/                   # Source assets for icon generation
└── icons/                       # Generated PWA icons
```

## Key Features

### PWA Integration
- All existing PWA features work in the Android app
- Service worker caching for offline functionality
- Push notifications support
- Background sync capabilities

### Native Android Features
- Native app icons and splash screens
- Android-specific optimizations
- Play Store distribution
- Native performance improvements

### API Integration
- Uses existing Cloudflare Workers APIs
- Real-time data updates
- Offline-first architecture
- Edge caching for performance

## Configuration

### Capacitor Configuration

The app is configured in `capacitor.config.ts`:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geticeti.rinkschedule',
  appName: 'Denver Rink Schedule',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

### Android Configuration

Key Android settings in `android/app/build.gradle`:

- **Application ID**: `com.geticeti.rinkschedule`
- **Version Code**: Incremented for each release
- **Version Name**: Semantic versioning (e.g., "1.0.0")
- **Min SDK Version**: 24 (Android 7.0)
- **Target SDK Version**: 33 (Android 13)

## Build Scripts

### NPM Scripts

```json
{
  "cap:sync": "npx cap sync",
  "cap:build": "npm run build && npx cap sync",
  "cap:android": "npx cap run android",
  "cap:android:build": "npm run cap:build && npx cap build android",
  "cap:android:release": "npm run cap:build && npx cap build android --prod"
}
```

### Gradle Tasks

```bash
# Debug builds
./gradlew assembleProdDebug
./gradlew installProdDebug

# Release builds
./gradlew assembleProdRelease
./gradlew bundleProdRelease

# Testing
./gradlew test
./gradlew connectedAndroidTest
```

## Deployment

### Manual Deployment

1. **Build the release APK/AAB**:
   ```bash
   npm run cap:build
   cd android
   ./gradlew bundleProdRelease
   ```

2. **Sign the app** (see [Android Signing Guide](android-signing.md))

3. **Upload to Play Store** via Play Console

### Automated Deployment

The project includes GitHub Actions workflows for automated builds:

- **`android-build.yml`**: Builds debug and release APKs on every push
- **`android-deploy.yml`**: Deploys signed AAB to Play Store on version tags

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Ensure Java 17 is installed and configured
   - Check Android SDK installation
   - Verify Gradle wrapper permissions: `chmod +x gradlew`

2. **Sync Issues**
   - Clear node_modules and reinstall: `rm -rf node_modules && npm install`
   - Clean Android build: `cd android && ./gradlew clean`

3. **Runtime Issues**
   - Check network permissions in AndroidManifest.xml
   - Verify CORS settings in API endpoints
   - Test on physical device for accurate performance

### Debug Commands

```bash
# Check Capacitor configuration
npx cap doctor

# View Android logs
cd android && ./gradlew installDebug && adb logcat

# Debug web content
npx cap run android --livereload --external

# Build with detailed output
cd android && ./gradlew assembleDebug --info
```

## Performance Optimization

### Web Performance
- Vite build optimization
- Code splitting and lazy loading
- Service worker caching
- Image optimization

### Android Performance
- ProGuard/R8 optimization
- Native library inclusion
- APK/AAB size optimization
- Battery usage optimization

## Security Considerations

### Network Security
- HTTPS enforcement
- Certificate pinning
- API key protection
- CORS configuration

### App Security
- Code obfuscation
- Root detection (if needed)
- Secure storage for sensitive data
- Play Store verification

## Monitoring and Analytics

### Error Tracking
- Consider implementing Sentry or similar
- Android crash reporting
- Performance monitoring

### Usage Analytics
- Google Analytics integration
- Play Console metrics
- User behavior tracking

## Future Enhancements

### Potential Features
- Push notifications for schedule updates
- Calendar integration
- Location-based features
- Offline data synchronization
- Widget support

### Platform Expansion
- iOS app development
- Desktop app (Electron)
- Web app enhancements
- Smart watch support

## Contributing

When contributing to the Android app:

1. Test on multiple Android versions
2. Verify PWA features work correctly
3. Test offline functionality
4. Check performance on lower-end devices
5. Ensure proper error handling

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/docs)
- [Play Store Publishing](https://play.google.com/console/about/guides/releasewithconfidence/)
- [PWA Best Practices](https://web.dev/progressive-web-apps/)