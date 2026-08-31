import { nitro } from "nitro/vite";
import { createRequire } from "node:module";
import { defineConfig } from "vite";
import vinext from "vinext";

// Vercel needs a Node function and Build Output API assets, not a Workers bundle.
// Keep the existing vite.config.ts for local development and Sites hosting.
export default defineConfig({
  resolve: {
    // Resolve the CSS export explicitly in Nitro's Node/RSC environments.
    alias: [{
      find: /^tailwindcss$/,
      replacement: createRequire(import.meta.url).resolve("tailwindcss/index.css"),
    }],
  },
  plugins: [vinext(), nitro({ preset: "vercel" })],
});
