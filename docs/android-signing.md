# Android App Signing Configuration

This document describes how to set up signing for the Android app.

## Required Secrets

Set these secrets in your GitHub repository settings:

### Keystore Secrets
- `KEYSTORE_BASE64`: Base64 encoded keystore file
- `KEYSTORE_PASSWORD`: Password for the keystore
- `KEY_ALIAS`: Alias name for the signing key
- `KEY_PASSWORD`: Password for the signing key

### Google Play Console Secrets
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: JSON content of the service account key file

## Creating a Keystore

To create a keystore for signing your app:

```bash
keytool -genkey -v -keystore keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

## Encoding the Keystore

To encode the keystore for GitHub secrets:

```bash
base64 -i keystore.jks -o keystore.base64
```

Then copy the content of `keystore.base64` to the `KEYSTORE_BASE64` secret.

## Setting up Google Play Console

1. Go to Google Play Console
2. Create a service account in Google Cloud Console
3. Download the JSON key file
4. Copy the entire JSON content to the `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secret

## Manual Build Commands

For local development and testing:

```bash
# Debug build
npm run cap:build
cd android
./gradlew assembleProdDebug

# Release build (unsigned)
npm run cap:build
cd android
./gradlew assembleProdRelease

# Signed release build
npm run cap:build
cd android
./gradlew bundleProdRelease \
  -Pandroid.injected.signing.store.file=app/keystore.jks \
  -Pandroid.injected.signing.store.password=YOUR_KEYSTORE_PASSWORD \
  -Pandroid.injected.signing.key.alias=YOUR_KEY_ALIAS \
  -Pandroid.injected.signing.key.password=YOUR_KEY_PASSWORD
```

## Version Management

The app version is managed in `android/app/build.gradle`. Update the `versionCode` and `versionName` before each release.

## Testing

Always test APKs on physical devices before deploying to Play Store:

1. Install debug APK on test devices
2. Test all core functionality
3. Verify network connectivity and API calls
4. Test offline functionality
5. Verify PWA features work correctly in the native app