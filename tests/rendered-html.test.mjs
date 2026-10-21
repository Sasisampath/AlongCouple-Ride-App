import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Along ships its product shell and primary ride actions", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /Come get me/);
  assert.match(page, /Location shared with her/);
  assert.match(page, /RequestsScreen/);
  assert.match(page, /DriverRidePanel/);
});

test("premium two-person onboarding and request details are present", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const design = await readFile(new URL("../app/design-system.css", import.meta.url), "utf8");
  assert.match(page, /Know when your person is actually on the way/);
  assert.match(page, /How do you usually travel together/);
  assert.match(page, /Ride.*Requests.*Us.*Profile/s);
  assert.match(page, /useState\(""\)/);
  assert.match(design, /--coral:\s*#e96562/i);
  assert.match(design, /--green:\s*#16855b/i);
  assert.match(design, /env\(safe-area-inset-bottom\)/);
});

test("PWA and map provider configuration are present", async () => {
  const layout = await readFile(new URL("../app/layout.tsx", import.meta.url), "utf8");
  const manifest = await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8");
  const map = await readFile(new URL("../app/components/live-map.tsx", import.meta.url), "utf8");
  const adapter = await readFile(new URL("../app/lib/map-adapter.ts", import.meta.url), "utf8");
  assert.match(layout, /manifest: "\/manifest\.webmanifest"/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.match(map, /maplibre-gl/);
  assert.match(map, /Allow location/);
  assert.match(adapter, /router\.project-osrm\.org/);
  assert.doesNotMatch(map, /DEMO MAP/);
});

test("Along is installable and the native bundle stays compatible with the web app", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
  );
  const pwaRuntime = await readFile(
    new URL("../app/components/pwa-runtime.tsx", import.meta.url),
    "utf8",
  );
  const capacitor = await readFile(new URL("../capacitor.config.ts", import.meta.url), "utf8");
  const androidManifest = await readFile(
    new URL("../android/app/src/main/AndroidManifest.xml", import.meta.url),
    "utf8",
  );

  assert.equal(manifest.name, "Along");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some((icon) => icon.purpose.includes("maskable")));
  assert.match(pwaRuntime, /isNativePlatform/);
  assert.match(capacitor, /appId:\s*"com\.along\.app"/);
  assert.match(capacitor, /webDir:\s*"dist\/capacitor"/);
  assert.match(androidManifest, /android\.permission\.ACCESS_FINE_LOCATION/);
  assert.match(androidManifest, /android\.permission\.ACCESS_COARSE_LOCATION/);
  assert.match(androidManifest, /android\.permission\.INTERNET/);
  assert.doesNotMatch(androidManifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.doesNotMatch(androidManifest, /android\.permission\.ACCESS_NETWORK_STATE/);
  assert.doesNotMatch(androidManifest, /ACCESS_BACKGROUND_LOCATION/);
});

test("demo controls and synthetic map locations stay isolated from production", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const demo = await readFile(new URL("../app/demo/page.tsx", import.meta.url), "utf8");
  const map = await readFile(new URL("../app/components/live-map.tsx", import.meta.url), "utf8");

  assert.match(demo, /<AlongApp demoMode/);
  assert.match(page, /onBrand=\{demoMode \?/);
  assert.match(page, /modal === "demo" && demoMode/);
  assert.match(map, /demoMode && rider && !driver/);
  assert.match(map, /aria-label="Along"/);
});
