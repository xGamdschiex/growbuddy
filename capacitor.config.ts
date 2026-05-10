import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.growbuddy.de',
  appName: 'GrowBuddy',
  webDir: 'build',
  server: {
    androidScheme: 'https',
  },
  // Production: WebView-Inspection deaktiviert (Play-Store-Anforderung).
  // Für lokales Debugging via chrome://inspect temporär auf true setzen
  // (capacitor.config.ts ist Build-Time-Config, kein Runtime-Switch möglich).
  android: {
    webContentsDebuggingEnabled: false,
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
