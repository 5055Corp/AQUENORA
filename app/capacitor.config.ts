import type { CapacitorConfig } from '@capacitor/cli';

// The AQUENORA iPhone app: this seller app (built with `npm run ios:build`) inside a native shell.
// See IOS.md for building and uploading to the App Store.
const config: CapacitorConfig = {
  appId: 'com.aquenora.seller',
  appName: 'AQUENORA',
  webDir: 'dist',
  backgroundColor: '#e9e3d9',
  ios: {
    backgroundColor: '#e9e3d9',
    // Links to other sites (store pages, Support, Privacy, WhatsApp) open in Safari or their app.
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    // Live updates from app.aquenora.com/live (see src/native.ts checkLiveUpdate); no Capgo account.
    CapacitorUpdater: {
      autoUpdate: false,
      // A new App Store version always starts from its own built-in screens.
      resetWhenUpdate: true,
      // If a downloaded version doesn't start properly within 10 s, the app goes back to the last good one.
      appReadyTimeout: 10000,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0A0612',
      showSpinner: false,
    },
  },
};

export default config;
