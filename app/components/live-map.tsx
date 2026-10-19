"use client";
/* eslint-disable @next/next/no-img-element -- the local profile photo is rendered inside a MapLibre DOM marker */

import { Bell, Crosshair, LoaderCircle, LocateFixed, LockKeyhole, MapPin, Radio } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { DeviceLocation, LocationPermission } from "../lib/geolocation";
import {
  BENGALURU_CENTER,
  DEMO_SASI_LOCATION,
  accuracyPolygon,
  buildRouteWaypoints,
  fetchRoadRoute,
  mapProvider,
  nearbyDemoCoordinate,
  toCoordinate,
  type MapCoordinate,
  type RouteGeometry,
} from "../lib/map-adapter";
import type { AppState, Role } from "../lib/types";

const SASI_PROFILE_PHOTO = "/sasi-profile.png";

type LiveMapProps = {
  state: AppState;
  role: Role;
  deviceLocation?: DeviceLocation;
  permission: LocationPermission;
  locationStatus: "idle" | "finding" | "ready" | "error" | "paused";
  focusSignal: number;
  visibleSpeed: number | null;
  onBrand: () => void;
  onAllowLocation: () => void;
  onRetryLocation: () => void;
  onManualPickup: () => void;
};

type MarkerSet = {
  rider?: MapLibreMarker;
  driver?: MapLibreMarker;
};

const EMPTY_COLLECTION = { type: "FeatureCollection" as const, features: [] };

const asFeature = (geometry: RouteGeometry | ReturnType<typeof accuracyPolygon>) => ({
  type: "Feature" as const,
  properties: {},
  geometry,
});

const smoothMarker = (
  marker: MapLibreMarker,
  next: MapCoordinate,
  animationRef: { current: number | null },
) => {
  if (animationRef.current) cancelAnimationFrame(animationRef.current);
  const current = marker.getLngLat();
  const start: MapCoordinate = [current.lng, current.lat];
  const startedAt = performance.now();
  const duration = 950;
  const frame = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - (1 - progress) ** 3;
    marker.setLngLat([
      start[0] + (next[0] - start[0]) * eased,
      start[1] + (next[1] - start[1]) * eased,
    ]);
    if (progress < 1) animationRef.current = requestAnimationFrame(frame);
  };
  animationRef.current = requestAnimationFrame(frame);
};

const createRiderMarker = (label: string, heading: number | null, demo: boolean) => {
  const element = document.createElement("div");
  element.className = `live-map-marker rider-live-marker${demo ? " demo-marker" : ""}`;
  element.innerHTML = `
    <div class="rider-marker-core"><i style="--marker-heading:${heading ?? 0}deg"></i></div>
    <span class="live-marker-label">${label}${demo ? "<small>demo nearby</small>" : ""}</span>
  `;
  return element;
};

const createDriverMarker = (label: string, meta: string, demo: boolean) => {
  const element = document.createElement("div");
  element.className = `live-map-marker driver-live-marker${demo ? " demo-marker" : ""}`;
  element.innerHTML = `
    <div class="driver-marker-photo"><b>S</b><img src="${SASI_PROFILE_PHOTO}" alt="" /><i></i></div>
    <span class="live-marker-label">${label}${meta ? `<small>${meta}</small>` : ""}</span>
  `;
  element.querySelector("img")?.addEventListener("error", (event) => {
    (event.currentTarget as HTMLImageElement).hidden = true;
  });
  return element;
};

const updateMarkerCopy = (marker: MapLibreMarker | undefined, label: string, meta: string) => {
  const copy = marker?.getElement().querySelector<HTMLElement>(".live-marker-label");
  if (!copy) return;
  copy.textContent = label;
  if (meta) {
    const detail = document.createElement("small");
    detail.textContent = meta;
    copy.append(detail);
  }
};

export function LiveMap({
  state,
  role,
  deviceLocation,
  permission,
  locationStatus,
  focusSignal,
  visibleSpeed,
  onBrand,
  onAllowLocation,
  onRetryLocation,
  onManualPickup,
}: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MarkerSet>({});
  const riderAnimationRef = useRef<number | null>(null);
  const driverAnimationRef = useRef<number | null>(null);
  const initialCameraRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [route, setRoute] = useState<RouteGeometry | null>(null);
  const [routeUnavailable, setRouteUnavailable] = useState(false);
  const [permissionDismissed, setPermissionDismissed] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  const destroyMap = useCallback(() => {
    if (riderAnimationRef.current) cancelAnimationFrame(riderAnimationRef.current);
    if (driverAnimationRef.current) cancelAnimationFrame(driverAnimationRef.current);
    markersRef.current.rider?.remove();
    markersRef.current.driver?.remove();
    markersRef.current = {};
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const locations = useMemo(() => {
    const current = toCoordinate(deviceLocation);
    const savedRider = toCoordinate(state.riderLocation);
    const savedDriver = toCoordinate(state.driverLocation);
    let rider = role === "rider" ? current ?? savedRider : savedRider;
    let driver = role === "driver" ? current ?? savedDriver : savedDriver;
    let riderIsDemo = false;
    let driverIsDemo = false;

    if (rider && !driver) {
      driver = nearbyDemoCoordinate(rider, state.stage, "driver");
      driverIsDemo = true;
    } else if (driver && !rider) {
      rider = nearbyDemoCoordinate(driver, state.stage, "rider");
      riderIsDemo = true;
    } else if (!rider && !driver) {
      if (role === "rider") {
        driver = DEMO_SASI_LOCATION;
        driverIsDemo = true;
      } else {
        rider = BENGALURU_CENTER;
        riderIsDemo = true;
      }
    }
    return { rider, driver, riderIsDemo, driverIsDemo };
  }, [deviceLocation, role, state.driverLocation, state.riderLocation, state.stage]);

  const routeWaypoints = useMemo(
    () => buildRouteWaypoints(state, locations.rider, locations.driver),
    [locations.driver, locations.rider, state],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current || state.edgeMode === "map-failed") return;
    let cancelled = false;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;

    void import("maplibre-gl").then((maplibre) => {
      if (cancelled || !containerRef.current) return;
      maplibre.setWorkerUrl(workerUrl);
      const map = new maplibre.Map({
        container: containerRef.current,
        style: mapProvider.styleUrl,
        center: BENGALURU_CENTER,
        zoom: 12.4,
        attributionControl: false,
        maxPitch: 55,
        dragRotate: false,
        touchPitch: true,
      });
      map.addControl(new maplibre.AttributionControl({ compact: true, customAttribution: "OpenFreeMap" }), "bottom-left");
      mapRef.current = map;
      loadTimer = setTimeout(() => {
        if (!map.loaded()) setMapFailed(true);
      }, 12000);

      map.once("load", () => {
        if (cancelled) return;
        if (loadTimer) clearTimeout(loadTimer);
        map.addSource("along-route", { type: "geojson", data: EMPTY_COLLECTION });
        map.addLayer({
          id: "along-route-casing",
          type: "line",
          source: "along-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "rgba(255,255,255,.92)", "line-width": 8, "line-blur": 0.4 },
        });
        map.addLayer({
          id: "along-route-line",
          type: "line",
          source: "along-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#25251f", "line-width": 5, "line-opacity": 0.94 },
        });
        map.addSource("rider-accuracy", { type: "geojson", data: EMPTY_COLLECTION });
        map.addLayer({
          id: "rider-accuracy-fill",
          type: "fill",
          source: "rider-accuracy",
          paint: { "fill-color": "#e96562", "fill-opacity": 0.12, "fill-outline-color": "rgba(34,34,34,.12)" },
        }, "along-route-casing");
        setMapReady(true);
      });

      map.on("error", () => {
        if (!map.isStyleLoaded()) setMapFailed(true);
      });
    }).catch(() => setMapFailed(true));

    return () => {
      cancelled = true;
      if (loadTimer) clearTimeout(loadTimer);
      destroyMap();
    };
  }, [destroyMap, state.edgeMode]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    void (async () => {
      const maplibre = await import("maplibre-gl");
      if (!mapRef.current) return;

      if (locations.rider) {
        if (!markersRef.current.rider) {
          markersRef.current.rider = new maplibre.Marker({
            element: createRiderMarker(role === "rider" ? "You" : "Monu", deviceLocation?.heading ?? null, locations.riderIsDemo),
            anchor: "center",
          }).setLngLat(locations.rider).addTo(map);
        } else {
          smoothMarker(markersRef.current.rider, locations.rider, riderAnimationRef);
          updateMarkerCopy(markersRef.current.rider, role === "rider" ? "You" : "Monu", locations.riderIsDemo ? "demo nearby" : "");
          const heading = markersRef.current.rider.getElement().querySelector<HTMLElement>(".rider-marker-core i");
          heading?.style.setProperty("--marker-heading", `${deviceLocation?.heading ?? 0}deg`);
        }
      } else {
        markersRef.current.rider?.remove();
        markersRef.current.rider = undefined;
      }

      if (locations.driver) {
        const driverMeta = locations.driverIsDemo
          ? "demo nearby"
          : visibleSpeed != null && !["idle", "requested"].includes(state.stage)
            ? `${visibleSpeed} km/h`
            : "8 min away";
        if (!markersRef.current.driver) {
          markersRef.current.driver = new maplibre.Marker({
            element: createDriverMarker(role === "driver" ? "You" : "Sasi", driverMeta, locations.driverIsDemo),
            anchor: "center",
          }).setLngLat(locations.driver).addTo(map);
        } else {
          smoothMarker(markersRef.current.driver, locations.driver, driverAnimationRef);
          updateMarkerCopy(markersRef.current.driver, role === "driver" ? "You" : "Sasi", driverMeta);
        }
      } else {
        markersRef.current.driver?.remove();
        markersRef.current.driver = undefined;
      }
    })();
  }, [deviceLocation?.heading, locations, mapReady, role, state.stage, visibleSpeed]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource("rider-accuracy") as GeoJSONSource | undefined;
    const location = locations.rider;
    const accuracy = role === "rider" ? deviceLocation?.accuracy : state.riderLocation?.accuracy;
    if (!source || !location || !accuracy || locations.riderIsDemo) {
      source?.setData(EMPTY_COLLECTION);
      return;
    }
    source.setData(asFeature(accuracyPolygon(location, Math.min(accuracy, 500))));
  }, [deviceLocation?.accuracy, locations.rider, locations.riderIsDemo, mapReady, role, state.riderLocation?.accuracy]);

  useEffect(() => {
    if (routeWaypoints.length < 2) {
      queueMicrotask(() => {
        setRoute(null);
        setRouteUnavailable(false);
      });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetchRoadRoute(routeWaypoints, controller.signal)
        .then((geometry) => {
          if (controller.signal.aborted) return;
          setRoute(geometry);
          setRouteUnavailable(!geometry);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setRoute(null);
            setRouteUnavailable(true);
          }
        });
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [routeWaypoints]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const source = mapRef.current.getSource("along-route") as GeoJSONSource | undefined;
    source?.setData(route ? asFeature(route) : EMPTY_COLLECTION);
  }, [mapReady, route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reducedMotion ? 0 : 950;

    if (route && route.coordinates.length > 1) {
      void import("maplibre-gl").then(({ LngLatBounds }) => {
        if (!mapRef.current) return;
        const bounds = route.coordinates.reduce(
          (current, coordinate) => current.extend(coordinate),
          new LngLatBounds(route.coordinates[0], route.coordinates[0]),
        );
        mapRef.current.fitBounds(bounds, { padding: { top: 112, right: 58, bottom: 74, left: 58 }, maxZoom: 15.8, duration });
      });
      initialCameraRef.current = true;
      return;
    }

    if (focusSignal > 0 && locations.rider && locations.driver) {
      void import("maplibre-gl").then(({ LngLatBounds }) => {
        if (!mapRef.current) return;
        const bounds = new LngLatBounds(locations.rider!, locations.rider!);
        bounds.extend(locations.driver!);
        mapRef.current.fitBounds(bounds, { padding: { top: 112, right: 62, bottom: 72, left: 62 }, maxZoom: 15.7, duration });
      });
      initialCameraRef.current = true;
      return;
    }

    const primary = role === "rider" ? locations.rider : locations.driver;
    if (primary && (!initialCameraRef.current || focusSignal > 0)) {
      map.easeTo({ center: primary, zoom: 15.3, duration });
      initialCameraRef.current = true;
    }
  }, [focusSignal, locations.driver, locations.rider, mapReady, role, route, state.stage]);

  useEffect(() => {
    const map = mapRef.current;
    const follow = role === "driver" ? locations.driver : locations.driver && ["active", "paused"].includes(state.stage) ? locations.driver : null;
    if (!mapReady || !map || !follow || !["active", "paused"].includes(state.stage)) return;
    map.easeTo({
      center: follow,
      zoom: 16.4,
      pitch: 38,
      bearing: deviceLocation?.heading ?? map.getBearing(),
      offset: [0, -54],
      duration: 850,
    });
  }, [deviceLocation?.heading, locations.driver, mapReady, role, state.stage]);

  const recenter = () => {
    if (!deviceLocation) {
      setPermissionDismissed(false);
      onAllowLocation();
      return;
    }
    mapRef.current?.flyTo({
      center: [deviceLocation.longitude, deviceLocation.latitude],
      zoom: 16,
      duration: 1050,
      essential: true,
    });
  };

  const simulatedMapFailure = state.edgeMode === "map-failed";
  const showMapFailure = simulatedMapFailure || mapFailed;
  const showPrompt = permission === "prompt" && !permissionDismissed;
  const showDenied = permission === "denied";
  const showUnavailable = permission === "unavailable" && !deviceLocation;
  const showFinding = locationStatus === "finding" && !deviceLocation;
  const accuracyLow = deviceLocation && deviceLocation.accuracy > 80;
  const lastAge = deviceLocation ? Math.max(0, Math.floor((clock - deviceLocation.timestamp) / 1000)) : null;
  const locationPaused = locationStatus === "paused" || (lastAge != null && lastAge > 30 && state.sharing);

  return (
    <div className={`map-stage real-map-stage map-${state.edgeMode}`} aria-label="Interactive live location map">
      <div ref={containerRef} className="live-map-canvas" />
      {!mapReady && !showMapFailure && <div className="real-map-loading" aria-label="Loading map"><span /><span /><i /></div>}

      {showMapFailure && (
        <div className="map-fallback real-map-fallback">
          <div><MapPin size={28} /><strong>Map temporarily unavailable</strong><span>You can still choose a pickup and send the ride.</span><button onClick={onManualPickup}>Choose pickup manually</button></div>
        </div>
      )}

      {!showMapFailure && showPrompt && (
        <div className="location-permission-card">
          <div className="location-card-icon"><Crosshair size={20} /></div>
          <div><strong>{role === "rider" ? "Use your location" : "Share your location"}</strong><p>{role === "rider" ? "Along uses your location to show where you are and help Sasi find you." : "Along shares your position with Monu only while this ride is active."}</p></div>
          <button className="allow-location-button" onClick={onAllowLocation}>Allow location</button>
          <button className="not-now-button" onClick={() => setPermissionDismissed(true)}>Not now</button>
        </div>
      )}

      {!showMapFailure && showDenied && (
        <div className="location-permission-card location-denied-card">
          <div className="location-card-icon"><LockKeyhole size={19} /></div>
          <div><strong>Location access is off</strong><p>Enable location in your browser settings to use live pickup.</p></div>
          <button className="allow-location-button" onClick={onRetryLocation}>Try again</button>
          <button className="not-now-button" onClick={onManualPickup}>Choose pickup manually</button>
        </div>
      )}

      {!showMapFailure && showUnavailable && (
        <div className="location-permission-card location-denied-card">
          <div className="location-card-icon"><Crosshair size={19} /></div>
          <div><strong>Location unavailable</strong><p>Along couldn’t get a reliable GPS fix. You can retry or continue with an address.</p></div>
          <button className="allow-location-button" onClick={onRetryLocation}>Try again</button>
          <button className="not-now-button" onClick={onManualPickup}>Choose pickup manually</button>
        </div>
      )}

      {!showMapFailure && showFinding && (
        <div className="location-state-chip finding"><LoaderCircle size={14} />Finding your location…</div>
      )}
      {!showMapFailure && accuracyLow && (
        <div className="location-state-chip accuracy"><Crosshair size={14} />Location accuracy is low · ±{Math.round(deviceLocation.accuracy)} m</div>
      )}
      {!showMapFailure && locationPaused && (
        <div className="location-state-chip paused"><Radio size={14} />Location updates paused{lastAge != null ? ` · ${lastAge}s ago` : ""}</div>
      )}
      {!showMapFailure && routeUnavailable && (
        <div className="route-unavailable-chip">Route temporarily unavailable</div>
      )}

      <header className="map-header">
        <button className="avatar-button" aria-label="Open Sasi profile"><span className="sasi-avatar-crop sasi-header-photo"><b aria-hidden="true">S</b><img src={SASI_PROFILE_PHOTO} alt="Sasi" width={88} height={88} onError={(event) => { event.currentTarget.hidden = true; }} /></span><i /></button>
        <button className="wordmark" onClick={onBrand} aria-label="Open preview controls"><span>A</span>along</button>
        <button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><i>2</i></button>
      </header>

      {state.sharing && <div className="sharing-chip is-sharing"><Radio size={13} />{role === "rider" ? "Sasi is sharing live location" : "Sharing live location with Monu"}</div>}
      {!showMapFailure && !showPrompt && !showDenied && !showUnavailable && <button className="locate-button" onClick={recenter} aria-label="Recenter on your location"><LocateFixed size={21} /></button>}
    </div>
  );
}
