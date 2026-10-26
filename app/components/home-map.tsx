"use client";
import { useEffect, useRef, useState } from "react";
import { Crosshair, GpsSlash as MapPinSlash } from "@phosphor-icons/react";
import type { Map as LibreMap, Marker, GeoJSONSource } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { BENGALURU_CENTER, mapProvider, type MapCoordinate, type RouteGeometry } from "../lib/map-adapter";

type Props = { own: MapCoordinate | null; partner: MapCoordinate | null; avatar: string | null;
  name: string; distance: string | null; stale: boolean; route?: RouteGeometry; cardHeight: number; onLocate: () => void };
const empty = { type: "FeatureCollection" as const, features: [] };
export function HomeMap({ own, partner, avatar, name, distance, stale, route, cardHeight, onLocate }: Props) {
  const canvas = useRef<HTMLDivElement>(null);
  const map = useRef<LibreMap | null>(null);
  const markers = useRef<{ own?: Marker; partner?: Marker }>({});
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [bubble, setBubble] = useState(false);
  const [focus, setFocus] = useState(0);
  const hasCentered = useRef(false);
  const lastFocus = useRef(0);
  const wasJourney = useRef(false);
  const cameraKey = `${own?.join(",")}|${partner?.join(",")}|${Boolean(route)}`;
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let resize: ResizeObserver | undefined;
    void import("maplibre-gl").then(lib => {
      if (cancelled || !canvas.current) return;
      lib.setWorkerUrl(workerUrl);
      const instance = new lib.Map({ container: canvas.current, style: mapProvider.styleUrl,
        center: BENGALURU_CENTER, zoom: 13.4, attributionControl: false, pitchWithRotate: false });
      map.current = instance;
      instance.addControl(new lib.AttributionControl({ compact: false }), "top-left");
      instance.dragRotate.disable(); instance.touchZoomRotate.disableRotation();
      timer = setTimeout(() => { if (!cancelled && !instance.isStyleLoaded()) setFailed(true); }, 15000);
      instance.on("load", () => {
        if (cancelled) return;
        clearTimeout(timer); setFailed(false);
        for (const layer of instance.getStyle().layers) {
          if (layer.type === "symbol" && /poi|housenumber/i.test(layer.id)) instance.setLayoutProperty(layer.id, "visibility", "none");
          if (layer.type === "background") instance.setPaintProperty(layer.id, "background-color", "#f4f0e9");
          if (layer.type === "fill" && /water/i.test(layer.id)) instance.setPaintProperty(layer.id, "fill-color", "#dce9e9");
        }
        instance.addSource("home-route", { type: "geojson", data: empty });
        instance.addLayer({ id: "home-route-case", type: "line", source: "home-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#fff", "line-width": 9 } });
        instance.addLayer({ id: "home-route-line", type: "line", source: "home-route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#FF6464", "line-width": 4.5, "line-opacity": 0, "line-opacity-transition": { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250 } } });
        setReady(true);
      });
      instance.on("error", () => { if (!cancelled && !instance.isStyleLoaded()) setFailed(true); });
      resize = new ResizeObserver(() => instance.resize()); resize.observe(canvas.current);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; clearTimeout(timer); resize?.disconnect();
      markers.current.own?.remove(); markers.current.partner?.remove(); markers.current = {};
      map.current?.remove(); map.current = null; };
  }, [retry]);

  useEffect(() => {
    if (!ready || !map.current) return;
    let cancelled = false;
    void import("maplibre-gl").then(lib => {
      if (cancelled || !map.current) return;
      for (const [key, coordinate] of [["own", own], ["partner", partner]] as const) {
        if (!coordinate) { markers.current[key]?.remove(); delete markers.current[key]; continue; }
        let marker = markers.current[key];
        if (!marker) {
          const element = document.createElement(key === "own" ? "div" : "button");
          element.className = key === "own" ? "home-own-marker" : "home-partner-marker";
          element.setAttribute("aria-label", key === "own" ? "Your location" : "Show partner location details");
          const core = document.createElement("span"); element.append(core);
          if (key === "partner") {
            element.addEventListener("click", () => setBubble(value => !value));
            const image = document.createElement("img"); image.alt = ""; core.append(image);
            image.addEventListener("error", () => { image.hidden = true; core.textContent = "?"; });
          }
          marker = new lib.Marker({ element, anchor: "center" }).setLngLat(coordinate).addTo(map.current);
          markers.current[key] = marker;
        }
        const old = marker.getLngLat();
        marker.setLngLat(coordinate);
        const element = marker.getElement();
        if ((old.lng !== coordinate[0] || old.lat !== coordinate[1]) && !matchMedia("(prefers-reduced-motion: reduce)").matches)
          element.firstElementChild?.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 250 });
        if (key === "partner") {
          element.classList.toggle("is-stale", stale);
          const image = element.querySelector("img");
          if (image) { image.hidden = !avatar; if (avatar && image.getAttribute("src") !== avatar) image.src = avatar; }
        }
      }
    });
    return () => { cancelled = true; };
  }, [ready, own, partner, avatar, stale]);

  useEffect(() => {
    if (!ready || !map.current) return;
    (map.current.getSource("home-route") as GeoJSONSource)?.setData(route ? { type: "Feature", properties: {}, geometry: route } : empty);
    map.current.setPaintProperty("home-route-line", "line-opacity", route ? 1 : 0);
  }, [ready, route]);

  useEffect(() => {
    if (!ready || !map.current) return;
    if (!own && !partner) { hasCentered.current = false; return; }
    const requestedFocus = focus !== lastFocus.current;
    const journeyEnded = wasJourney.current && !route;
    wasJourney.current = Boolean(route);
    if (hasCentered.current && !route && !requestedFocus && !journeyEnded) return;
    lastFocus.current = focus;
    const instance = map.current;
    const duration = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300;
    const height = instance.getContainer().clientHeight;
    const bottom = Math.min(cardHeight + 165, height - 200);
    if (own && partner && (route || !hasCentered.current || journeyEnded)) {
      instance.fitBounds([[Math.min(own[0],partner[0]),Math.min(own[1],partner[1])], [Math.max(own[0],partner[0]),Math.max(own[1],partner[1])]],
        { padding: { top: 150, bottom, left: 65, right: 65 }, maxZoom: 16, duration });
    } else instance.easeTo({ center: own ?? partner!, zoom: 15, padding: { top: 150, bottom, left: 0, right: 0 }, duration });
    hasCentered.current = true;
    // Coordinate values, not parent render identity, control camera movement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cameraKey, focus, cardHeight]);

  return <div className="home-map" aria-label="Along location map">
    <div ref={canvas} className="home-map-canvas" />
    {failed ? <div className="home-map-error"><MapPinSlash size={24} /><strong>Map temporarily unavailable</strong><button onClick={() => { setReady(false); setFailed(false); hasCentered.current = false; setRetry(v => v + 1); }}>Retry map</button></div>
      : !ready && <span className="home-map-loading" role="status">Loading map…</span>}
    {bubble && partner && <div className="home-marker-bubble" role="status"><strong>{name}</strong><span>{stale ? "Location unavailable" : distance ?? "Distance unavailable"}</span></div>}
    <button className="home-recenter" aria-label="Recenter map" onClick={() => { if (own) setFocus(v => v + 1); else onLocate(); }}><Crosshair size={22} /></button>
  </div>;
}
