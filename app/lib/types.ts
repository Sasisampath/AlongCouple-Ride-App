import type { DeviceLocation } from "./geolocation";

export type Role = "rider" | "driver";
export type Tab = "ride" | "requests" | "us" | "profile";

export type RideStage =
  | "idle"
  | "requested"
  | "accepted"
  | "enroute"
  | "nearby"
  | "arrived"
  | "active"
  | "paused"
  | "complete"
  | "declined"
  | "timedout"
  | "cancelled";

export type PitStopStatus = "requested" | "secured" | "unavailable";

export type PitStop = {
  id: string;
  kind: "chocolate" | "coffee" | "flowers" | "drink" | "medicine" | "grocery" | "stop" | "custom";
  title: string;
  detail: string;
  status: PitStopStatus;
  emoji: string;
};

export type EdgeMode =
  | "normal"
  | "offline"
  | "weak"
  | "stale"
  | "gps-low"
  | "gps-denied"
  | "map-failed"
  | "backgrounded";

export type AppState = {
  role: Role;
  stage: RideStage;
  driverOnline: boolean;
  sharing: boolean;
  destination: string;
  pickup: string;
  pitStops: PitStop[];
  riderReady: boolean;
  edgeMode: EdgeMode;
  lastUpdated: number;
  activeTab: Tab;
  appearance: "light" | "dark";
  riderLocation?: DeviceLocation;
  driverLocation?: DeviceLocation;
};

export const INITIAL_STATE: AppState = {
  role: "rider",
  stage: "idle",
  driverOnline: true,
  sharing: false,
  destination: "",
  pickup: "Choose your pickup location",
  pitStops: [],
  riderReady: false,
  edgeMode: "normal",
  lastUpdated: Date.now(),
  activeTab: "ride",
  appearance: "light",
};
