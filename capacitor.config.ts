import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.along.app",
  appName: "Along",
  // Vinext's normal output is server-backed. This directory is the dedicated,
  // self-contained Vite bundle produced alongside it by `npm run build`.
  webDir: "dist/capacitor",
  android: {
    allowMixedContent: false,
    backgroundColor: "#ffffff",
  },
  server: {
    androidScheme: "https",
  },
};

export default config;
