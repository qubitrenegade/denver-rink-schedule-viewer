import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.geticetime.denverrinkschedule',
  appName: 'Denver Rink Schedule',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  ios: {
    scheme: 'Denver Rink Schedule',
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
    preferredContentMode: 'mobile'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#2563eb',
      splashFullScreen: false,
      splashImmersive: false,
      layoutName: 'launch_screen',
      useDialog: false,
    },
    StatusBar: {
      style: 'default',
      backgroundColor: '#ffffff',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      style: 'light',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
