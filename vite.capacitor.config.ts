import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL("./capacitor", import.meta.url)),
  base: "./",
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  plugins: [react()],
  css: {
    postcss: `${projectRoot}postcss.config.mjs`,
  },
  build: {
    outDir: fileURLToPath(new URL("./dist/capacitor", import.meta.url)),
    // Do not retain removed PNGs or previous hashed assets in the native bundle.
    emptyOutDir: true,
    sourcemap: true,
  },
});
