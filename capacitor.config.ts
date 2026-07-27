/// <reference types="@capacitor/keyboard" />
/// <reference types="@capacitor/splash-screen" />

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.doubleheelix.huddleassistant",
  appName: "Huddle Assistant",
  webDir: "dist",
  backgroundColor: "#f4efe7",
  loggingBehavior: "production",
  android: {
    allowMixedContent: false,
    backgroundColor: "#f4efe7",
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    Keyboard: {
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 900,
      backgroundColor: "#f4efe7",
      showSpinner: false,
    },
    SystemBars: {
      style: "DARK",
    },
  },
};

export default config;
