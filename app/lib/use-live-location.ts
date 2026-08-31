"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  snapshotPosition,
  SpeedSmoother,
  type DeviceLocation,
  type LocationPermission,
  type SpeedReading,
} from "./geolocation";
import type { EdgeMode, Role } from "./types";

type LocationStatus = "idle" | "finding" | "ready" | "error" | "paused";

type UseLiveLocationOptions = {
  role: Role;
  tracking: boolean;
  edgeMode: EdgeMode;
  initialLocation?: DeviceLocation;
  onLocation: (location: DeviceLocation) => void;
};

const EMPTY_READING: SpeedReading = {
  speedKmh: null,
  accuracy: null,
  source: "unavailable",
  lastUpdated: null,
};

export function useLiveLocation({
  role,
  tracking,
  edgeMode,
  initialLocation,
  onLocation,
}: UseLiveLocationOptions) {
  const [permission, setPermission] = useState<LocationPermission>("prompt");
  const [status, setStatus] = useState<LocationStatus>(initialLocation ? "ready" : "idle");
  const [location, setLocation] = useState<DeviceLocation | undefined>(initialLocation);
  const [reading, setReading] = useState<SpeedReading>(EMPTY_READING);
  const [enabled, setEnabled] = useState(false);
  const [requestNonce, setRequestNonce] = useState(0);
  const [isBackgrounded, setIsBackgrounded] = useState(false);
  const smootherRef = useRef(new SpeedSmoother());
  const onLocationRef = useRef(onLocation);
  const previousRoleRef = useRef(role);

  useEffect(() => {
    onLocationRef.current = onLocation;
  }, [onLocation]);

  useEffect(() => {
    if (previousRoleRef.current === role) return;
    previousRoleRef.current = role;
    setLocation(initialLocation);
    setReading(initialLocation ? {
      speedKmh: initialLocation.speedKmh,
      accuracy: initialLocation.accuracy,
      source: initialLocation.speedSource,
      lastUpdated: initialLocation.timestamp,
    } : EMPTY_READING);
    setStatus(initialLocation ? "ready" : "idle");
    smootherRef.current = new SpeedSmoother();
  }, [initialLocation, role]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    let active = true;
    const query = navigator.permissions?.query({ name: "geolocation" });
    if (!query) return () => { active = false; };
    query.then((result) => {
      if (!active) return;
      const syncPermission = () => {
        const next = result.state as Exclude<LocationPermission, "unavailable">;
        setPermission(next);
        if (next === "granted") setEnabled(true);
        if (next === "denied") setStatus("error");
      };
      syncPermission();
      result.addEventListener("change", syncPermission);
    }).catch(() => {
      // Safari may omit the Permissions API. The explicit CTA still works.
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      setIsBackgrounded(hidden);
      if (hidden && tracking) setStatus("paused");
      if (!hidden && enabled) setStatus("finding");
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, tracking]);

  const consumePosition = useCallback((position: GeolocationPosition) => {
    const nextReading = edgeMode === "gps-low"
      ? { speedKmh: null, accuracy: 140, source: "unavailable" as const, lastUpdated: Date.now() }
      : smootherRef.current.add(position);
    const snapshot = snapshotPosition(position, nextReading);
    const next = edgeMode === "gps-low" ? { ...snapshot, accuracy: Math.max(snapshot.accuracy, 140) } : snapshot;
    setPermission("granted");
    setStatus("ready");
    setLocation(next);
    setReading(nextReading);
    onLocationRef.current(next);
  }, [edgeMode]);

  const consumeError = useCallback((error: GeolocationPositionError) => {
    const denied = error.code === error.PERMISSION_DENIED || edgeMode === "gps-denied";
    setPermission(denied ? "denied" : "unavailable");
    setStatus("error");
  }, [edgeMode]);

  useEffect(() => {
    if (!enabled || !navigator.geolocation || isBackgrounded || edgeMode === "gps-denied") return;
    const options: PositionOptions = tracking
      ? { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
      : { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 };

    if (tracking) {
      const watchId = navigator.geolocation.watchPosition(consumePosition, consumeError, options);
      return () => navigator.geolocation.clearWatch(watchId);
    }

    navigator.geolocation.getCurrentPosition(consumePosition, consumeError, options);
  }, [consumeError, consumePosition, edgeMode, enabled, isBackgrounded, requestNonce, role, tracking]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setPermission("unavailable");
      setStatus("error");
      return;
    }
    setStatus("finding");
    setEnabled(true);
    setRequestNonce((value) => value + 1);
  }, []);

  const retry = useCallback(() => {
    setPermission("prompt");
    setStatus("finding");
    setEnabled(true);
    setRequestNonce((value) => value + 1);
  }, []);

  const markUnavailable = useCallback(() => {
    setStatus("error");
  }, []);

  return {
    permission: edgeMode === "gps-denied" ? "denied" as const : permission,
    status,
    location,
    reading,
    requestLocation,
    retry,
    markUnavailable,
    isBackgrounded,
  };
}
