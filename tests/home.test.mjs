import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const source = await readFile(new URL("../app/lib/home-state.ts", import.meta.url), "utf8");
const model = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString("base64")}`);
const point = { source: "device", latitude: 12.97, longitude: 77.64, timestamp: 100_000, accuracy: 10 };
test("real Home rejects simulated and invalid GPS coordinates", () => {
  assert.equal(model.realCoordinate(), null);
  assert.equal(model.realCoordinate({ ...point, source: "demo" }), null);
  assert.equal(model.realCoordinate({ ...point, latitude: NaN }), null);
  assert.equal(model.realCoordinate({ ...point, longitude: 181 }), null);
  assert.deepEqual(model.realCoordinate(point), [77.64, 12.97]);
});
test("distance is separate from ETA and handles zero movement", () => {
  assert.equal(model.distanceLabel(null, [77, 12]), null);
  assert.equal(model.distanceLabel([77, 12], [77, 12]), "Nearby");
  assert.match(model.distanceLabel([77,12], [77.01,12]), /km away$/);
});
test("stale, missing, offline and clock-skewed partner readings are unavailable", () => {
  const partner = { online: true, location: point };
  assert.equal(model.partnerUnavailable(partner, 110_000), false);
  assert.equal(model.partnerUnavailable(partner, 200_000), true);
  assert.equal(model.partnerUnavailable({ ...partner, online: false }, 110_000), true);
  assert.equal(model.partnerUnavailable({ online: true }, 110_000), true);
  assert.equal(model.partnerUnavailable(partner, 10_000), true);
  assert.equal(model.locationAge(undefined, 110_000), null);
  assert.equal(model.locationAge(100_000, 10_000), null);
  assert.equal(model.locationAge(100_000, 1_180_000), "18 min ago");
});
test("tour progresses deterministically and routes begin only after acceptance", () => {
  assert.deepEqual(model.tourStages, ["requested", "accepted", "enroute", "nearby", "arrived"]);
  assert.equal(model.tourRoute("idle"), undefined);
  assert.equal(model.tourRoute("requested"), undefined);
  for (const stage of model.tourStages.slice(1)) {
    const route = model.tourRoute(stage);
    assert.equal(route.type, "LineString");
    assert.deepEqual(route.coordinates.at(-1), model.tourUser);
  }
});
test("Home uses explicit account boundary, neutral names and official icon components", async () => {
  const home = await readFile(new URL("../app/components/home-experience.tsx", import.meta.url), "utf8");
  assert.match(home, /Tour mode/);
  assert.match(home, /connection\?: HomeConnection/);
  assert.match(home, /@phosphor-icons\/react/);
  assert.doesNotMatch(home, /Sasi|Monu|lucide-react/);
  const map = await readFile(new URL("../app/components/home-map.tsx", import.meta.url), "utf8");
  assert.match(map, /mapProvider.styleUrl/);
  assert.match(map, /AttributionControl/);
  assert.doesNotMatch(map, /fetchRoadRoute|tile.openstreetmap.org/);
});
