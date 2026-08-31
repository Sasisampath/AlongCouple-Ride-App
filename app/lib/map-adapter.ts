import type { DeviceLocation } from "./geolocation";
import type { AppState, PitStop, RideStage } from "./types";

export type MapCoordinate = [longitude: number, latitude: number];

export type RouteGeometry = {
  type: "LineString";
  coordinates: MapCoordinate[];
};

export type MapProviderConfig = {
  provider: "maplibre";
  styleUrl: string;
  attribution: string;
};

const OPEN_FREE_MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";
const OSRM_ROUTE_ENDPOINT = "https://router.project-osrm.org/route/v1/driving";

export const mapProvider: MapProviderConfig = {
  provider: "maplibre",
  styleUrl: import.meta.env.VITE_MAP_STYLE_URL || OPEN_FREE_MAP_STYLE,
  attribution: "© OpenStreetMap contributors · OpenFreeMap",
};

export const BENGALURU_CENTER: MapCoordinate = [77.6412, 12.9719];
export const DEMO_SASI_LOCATION: MapCoordinate = [77.6328, 12.9826];

const KNOWN_DESTINATIONS: Record<string, MapCoordinate> = {
  "Defence Colony, Indiranagar": [77.6431, 12.9784],
  "Embassy Golf Links, Domlur": [77.6461, 12.9515],
  "12th Main Road": [77.6414, 12.9698],
  "Third Wave Coffee": [77.6414, 12.9698],
  Home: [77.6431, 12.9784],
};

const DEMO_STOPS: Partial<Record<PitStop["kind"], MapCoordinate>> = {
  chocolate: [77.6385, 12.9768],
  coffee: [77.6414, 12.9698],
  flowers: [77.6448, 12.9739],
  drink: [77.6376, 12.9711],
  medicine: [77.6358, 12.9747],
  grocery: [77.6462, 12.9677],
  stop: [77.6428, 12.9656],
};

export const toCoordinate = (location?: DeviceLocation): MapCoordinate | null =>
  location ? [location.longitude, location.latitude] : null;

export const nearbyDemoCoordinate = (
  origin: MapCoordinate,
  stage: RideStage,
  partner: "driver" | "rider",
): MapCoordinate => {
  const progress: Partial<Record<RideStage, number>> = {
    accepted: 0.82,
    enroute: 0.58,
    nearby: 0.15,
    arrived: 0.015,
    active: 0.008,
    paused: 0.008,
  };
  const factor = progress[stage] ?? 1;
  const direction = partner === "driver" ? 1 : -1;
  return [origin[0] + 0.014 * factor * direction, origin[1] + 0.01 * factor];
};

const resolveDestination = (destination: string): MapCoordinate | null => {
  if (!destination) return null;
  const match = Object.entries(KNOWN_DESTINATIONS).find(([name]) =>
    destination.toLowerCase().includes(name.toLowerCase()),
  );
  return match?.[1] ?? null;
};

const routeStops = (pitStops: PitStop[]) => pitStops
  .filter((stop) => stop.status !== "unavailable")
  .map((stop) => DEMO_STOPS[stop.kind])
  .filter((coordinate): coordinate is MapCoordinate => Boolean(coordinate));

export function buildRouteWaypoints(
  state: AppState,
  rider: MapCoordinate | null,
  driver: MapCoordinate | null,
): MapCoordinate[] {
  if (!rider || !driver || ["idle", "declined", "timedout", "cancelled", "complete"].includes(state.stage)) {
    return [];
  }

  const inSeededArea = Math.abs(rider[0] - BENGALURU_CENTER[0]) < 0.25
    && Math.abs(rider[1] - BENGALURU_CENTER[1]) < 0.25;
  const stops = inSeededArea ? routeStops(state.pitStops) : [];
  if (["requested", "accepted", "enroute", "nearby", "arrived"].includes(state.stage)) {
    return [driver, ...stops, rider];
  }

  const destination = inSeededArea ? resolveDestination(state.destination) : null;
  return [driver, ...stops, ...(destination ? [destination] : [])];
}

export async function fetchRoadRoute(
  waypoints: MapCoordinate[],
  signal?: AbortSignal,
): Promise<RouteGeometry | null> {
  if (waypoints.length < 2) return null;
  const encoded = waypoints.map(([longitude, latitude]) => `${longitude},${latitude}`).join(";");
  const response = await fetch(
    `${OSRM_ROUTE_ENDPOINT}/${encoded}?overview=full&geometries=geojson&steps=false`,
    { signal },
  );
  if (!response.ok) return null;
  const payload = await response.json() as {
    code?: string;
    routes?: Array<{ geometry?: RouteGeometry }>;
  };
  if (payload.code !== "Ok") return null;
  return payload.routes?.[0]?.geometry ?? null;
}

export function accuracyPolygon(
  center: MapCoordinate,
  radiusMetres: number,
): { type: "Polygon"; coordinates: MapCoordinate[][] } {
  const [longitude, latitude] = center;
  const latFactor = radiusMetres / 111_320;
  const lngFactor = radiusMetres / (111_320 * Math.cos((latitude * Math.PI) / 180));
  const ring: MapCoordinate[] = [];
  for (let index = 0; index <= 48; index += 1) {
    const angle = (index / 48) * Math.PI * 2;
    ring.push([longitude + Math.cos(angle) * lngFactor, latitude + Math.sin(angle) * latFactor]);
  }
  return { type: "Polygon", coordinates: [ring] };
}
