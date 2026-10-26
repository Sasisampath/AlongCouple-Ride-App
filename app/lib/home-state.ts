import type { DeviceLocation } from "./geolocation";
import type { MapCoordinate, RouteGeometry } from "./map-adapter";

export type HomeStage = "idle" | "requested" | "accepted" | "enroute" | "nearby" | "arrived";
// Supply this only from an authenticated pairing/realtime adapter, never the seeded ride store.
export type HomeConnection = {
  id: string;
  name?: string;
  avatar: string | null;
  online: boolean;
  location?: DeviceLocation;
  stage: HomeStage;
  route?: RouteGeometry;
  etaMinutes?: number;
  sharing: boolean;
  requestPickup: () => Promise<void>;
  cancelRequest: () => Promise<void>;
  endRide: () => Promise<void>;
  message: () => void;
};

export function realCoordinate(location?: DeviceLocation): MapCoordinate | null {
  if (!location || location.source !== "device" || !Number.isFinite(location.longitude) || !Number.isFinite(location.latitude)
    || Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) return null;
  return [location.longitude, location.latitude];
}

export function locationAge(timestamp: number | undefined, now: number): string | null {
  if (!timestamp || !Number.isFinite(timestamp) || timestamp > now + 30_000) return null;
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  return seconds < 60 ? "just now" : `${Math.floor(seconds / 60)} min ago`;
}

export function partnerUnavailable(partner: HomeConnection, now: number) {
  const timestamp = partner.location?.timestamp;
  return !partner.online || !realCoordinate(partner.location) || !timestamp || !Number.isFinite(timestamp)
    || timestamp > now + 30_000 || now - timestamp > 90_000;
}

export function distanceLabel(a: MapCoordinate | null, b: MapCoordinate | null): string | null {
  if (!a || !b) return null;
  const rad = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * rad / 2) ** 2
    + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2;
  const km = 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return km < .1 ? "Nearby" : `${km.toFixed(1)} km away`;
}

export const tourUser: MapCoordinate = [77.6412, 12.9719];
export const tourPath: MapCoordinate[] = [[77.6328,12.9826],[77.6375,12.9826],[77.6375,12.9785],[77.6412,12.9785],[77.6412,12.9719]];
export const tourStages: HomeStage[] = ["requested", "accepted", "enroute", "nearby", "arrived"];
export function tourPosition(stage: HomeStage): MapCoordinate {
  return stage === "arrived" ? [77.6413,12.9721] : stage === "nearby" ? [77.6412,12.9742]
    : stage === "enroute" ? tourPath[2] : tourPath[0];
}
export function tourRoute(stage: HomeStage): RouteGeometry | undefined {
  if (["idle", "requested"].includes(stage)) return undefined;
  const point = tourPosition(stage);
  return { type: "LineString", coordinates: stage === "nearby" || stage === "arrived"
    ? [point, tourUser] : [point, ...tourPath.slice(stage === "enroute" ? 3 : 1)] };
}
