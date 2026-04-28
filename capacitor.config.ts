import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.growbuddy.de',
  appName: 'GrowBuddy',
  webDir: 'build',
  server: {
    androidScheme: 'https',
  },
  // Beta-Phase: WebView-Inspection erlauben für chrome://inspect Live-Diagnose
  // TODO vor Play-Store-Submission: auf false setzen
  android: {
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      splashFullScreen: true,
      splashImmersive: true,
      launchShowDuration: 1500,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0a0a',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#22c55e',
    },
  },
};

export default config;
