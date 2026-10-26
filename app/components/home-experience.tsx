"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, ChatCircleDots, Crosshair, Heart, House, ListBullets, MapPinLine, GpsSlash as MapPinSlash, NavigationArrow, PaperPlaneTilt, UserCircle, UserPlus, X } from "@phosphor-icons/react";
import { HomeMap } from "./home-map";
import { distanceLabel, locationAge, partnerUnavailable, realCoordinate, tourPosition, tourRoute, tourStages, tourUser, type HomeConnection, type HomeStage } from "../lib/home-state";
import type { DeviceLocation, LocationPermission } from "../lib/geolocation";
import type { Tab } from "../lib/types";
import "./home-experience.css";

type Props = {
  authenticated: boolean; demoMode: boolean; selectedAvatar: string | null;
  location?: DeviceLocation; permission: LocationPermission; locationStatus: string;
  onAllowLocation: () => void; onInvite: () => void;
  connection?: HomeConnection; // Deliberately absent until the real pairing adapter is available.
};
export function HomeExperience({ authenticated, demoMode, selectedAvatar, location, permission, locationStatus, onAllowLocation, onInvite, connection }: Props) {
  const [tour, setTour] = useState(() => {
    if (demoMode) return true;
    try { return !authenticated && localStorage.getItem("along.home.explored.v1") !== "true"; } catch { return !authenticated; }
  });
  const isTour = tour && !connection;
  const card = useRef<HTMLDivElement>(null);
  const [cardHeight, setCardHeight] = useState(300);
  useEffect(() => {
    if (!card.current) return;
    const observer = new ResizeObserver(entries => setCardHeight(entries[0].borderBoxSize?.[0]?.blockSize ?? entries[0].contentRect.height));
    observer.observe(card.current); return () => observer.disconnect();
  }, []);
  const [tourStage, setTourStage] = useState<HomeStage>("idle");
  const [permissionDismissed, setPermissionDismissed] = useState(false);
  const [details, setDetails] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [lastPartner, setLastPartner] = useState<{ id: string; location: DeviceLocation } | null>(null);
  useEffect(() => {
    if (!connection) { setLastPartner(null); return; }
    if (realCoordinate(connection.location)) setLastPartner({ id: connection.id, location: connection.location! });
  }, [connection?.id, connection?.location]);
  const busy = useRef(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (!isTour || tourStage === "idle" || tourStage === "arrived") return;
    const timer = setTimeout(() => setTourStage(tourStages[tourStages.indexOf(tourStage) + 1]), tourStage === "accepted" ? 1800 : 3600);
    return () => clearTimeout(timer);
  }, [isTour, tourStage]);
  const leaveTour = () => {
    setTour(false); setTourStage("idle"); setPermissionDismissed(true);
    try { localStorage.setItem("along.home.explored.v1", "true"); } catch { /* Session-only exploration. */ }
  };
  const own = isTour ? tourUser : permission === "granted" ? realCoordinate(location) : null;
  const partnerLocation = realCoordinate(connection?.location) ? connection?.location : connection?.id === lastPartner?.id ? lastPartner?.location : undefined;
  const partner = isTour ? tourPosition(tourStage) : realCoordinate(partnerLocation);
  const stale = !isTour && Boolean(connection && partnerUnavailable(connection, now));
  const stage = isTour ? tourStage : connection?.stage ?? "idle";
  const route = isTour ? tourRoute(stage) : ["accepted", "enroute", "nearby", "arrived"].includes(stage) ? connection?.route : undefined;
  const distance = isTour ? stage === "arrived" ? "Nearby" : stage === "nearby" ? "200 m away" : "2.4 km away" : distanceLabel(own, partner);
  const rawEta = isTour ? stage === "nearby" ? 1 : 8 : connection?.etaMinutes;
  const eta = rawEta != null && Number.isFinite(rawEta) && rawEta >= 0 ? Math.ceil(rawEta) : null;
  const partnerName = connection?.name?.trim() || "Your person";
  const avatar = isTour ? selectedAvatar || "/setup/avatar-7.png" : connection?.avatar ?? null;
  const needsPermission = !isTour && !own && !permissionDismissed;
  const runAction = async (action?: () => Promise<void>) => {
    if (!action || busy.current) return;
    busy.current = true; setPending(true); setMessage("");
    try { await action(); } catch { setMessage("Couldn’t complete that. Check your connection and try again."); }
    finally { busy.current = false; setPending(false); }
  };
  const locate = () => {
    if (isTour) return;
    setPermissionDismissed(false);
  };
  const primary = (text: string, action: () => void, icon = <NavigationArrow size={20} weight="fill" />) =>
    <button className="along-home-primary" disabled={pending} onClick={action}>{icon}<span>{pending ? "Please wait…" : text}</span></button>;
  const secondary = (text: string, action: () => void) => <button className="along-home-secondary" disabled={pending} onClick={action}>{text}</button>;
  return <section className="along-home" aria-label="Home" style={{ "--home-card-height": `${cardHeight}px` } as CSSProperties}>
    <HomeMap own={own} partner={partner} avatar={avatar} name={partnerName} distance={distance} stale={stale} route={route} cardHeight={cardHeight} onLocate={locate} />
    <header className="along-home-header">
      <img src="/brand/along-map-icon.png" alt="Along" />
      {isTour ? <span className="along-home-status"><i />Tour mode</span> : connection && <span className="along-home-status"><i className={connection.sharing ? "sharing" : "paused"} />Location {connection.sharing ? "shared" : "paused"}</span>}
    </header>
    <div ref={card} className="along-home-card" aria-live="polite" aria-atomic="true">
      {needsPermission ? <>
        <span className="along-home-symbol"><MapPinLine size={26} /></span>
        <h1>See each other<br />on the map</h1>
        <p>{permission === "denied" ? "Location access is off. Enable it in your browser or app settings." : permission === "unavailable" ? "Location is unavailable. Try again when you have a GPS signal." : "Turn on location to use live distance."}</p>
        {primary(locationStatus === "finding" ? "Finding your location…" : "Allow location", onAllowLocation, <MapPinLine size={20} />)}
        {secondary("Not now", () => setPermissionDismissed(true))}
      </> : stale ? <>
        <span className="along-home-symbol neutral"><MapPinSlash size={26} /></span><h1>Location unavailable</h1>
        {locationAge(partnerLocation?.timestamp, now) && <p>Last updated {locationAge(partnerLocation?.timestamp, now)}</p>}
        {secondary("Message", () => connection?.message())}
      </> : isTour && stage === "idle" ? <>
        <div className="along-home-tour-copy"><span className="along-home-eyebrow">A LITTLE LOOK AROUND</span><h1>See how<br />Along works</h1><p>A practice journey. Just for you.</p></div>
        {primary("Try Come get me", () => setTourStage("requested"))}
        {secondary("Explore first", leaveTour)}
      </> : !isTour && !connection ? <>
        <div className="along-home-invite"><img src="/setup/invite.png" alt="Two people connecting with Along" /><h1>Bring your<br />person Along</h1></div>
        {primary("Invite your person", onInvite, <UserPlus size={20} />)}
        {secondary("Explore first", () => { setTour(true); setTourStage("idle"); })}
      </> : stage === "requested" ? <>
        <span className="along-home-symbol"><PaperPlaneTilt size={26} /></span><h1>Request sent ❤️</h1><p>Waiting for your person…</p>
        {secondary("Cancel request", () => isTour ? setTourStage("idle") : void runAction(connection?.cancelRequest))}
      </> : stage === "arrived" ? <>
        <Heart className="along-arrival-heart" size={30} weight="fill" /><h1>They’re here ❤️</h1><p>A little closer, together.</p>
        {primary("End ride", () => isTour ? setTourStage("idle") : void runAction(connection?.endRide), <Heart size={20} />)}
      </> : ["accepted", "enroute", "nearby"].includes(stage) ? <>
        <span className="along-home-eyebrow">{stage === "accepted" ? "Got it" : stage === "nearby" ? "Almost there" : "On the way"}</span>
        <h1 className="along-home-eta">{eta != null ? <>{eta}<span> min{stage === "nearby" ? " away" : ""}</span></> : "On the way"}</h1>
        <p>{distance ?? "Distance unavailable"}{!isTour && eta == null ? " · ETA unavailable" : ""}</p>
        <div className="along-home-actions"><button onClick={() => isTour ? setMessage("Tour mode — no message is sent to anyone.") : connection?.message()}><ChatCircleDots size={20} />Message</button><button onClick={() => setDetails(true)}><ListBullets size={20} />Details</button></div>
      </> : <>
        <div className="along-home-partner">{avatar ? <img src={avatar} alt="" /> : <UserCircle size={46} />}<div><h1>{partnerName}</h1><p>{distance ?? "Distance unavailable"}{eta != null ? ` · ${eta} min` : ""}</p></div></div>
        {primary("Come get me", () => { if (!own) setPermissionDismissed(false); else void runAction(connection?.requestPickup); })}
      </>}
      {!isTour && own && location && (locationStatus === "paused" || now - location.timestamp > 90_000 || location.accuracy > 100) && <p className="along-home-note"><Crosshair size={14} />{location.accuracy > 100 ? "Your location accuracy is low" : "Your location updates are paused"}</p>}
      {message && <button className="along-home-feedback" onClick={() => setMessage("")}>{message}<X size={16} /></button>}
    </div>
    {details && <JourneyDetails isTour={isTour} distance={distance} eta={eta} route={Boolean(route)} onClose={() => setDetails(false)} />}
  </section>;
}

function JourneyDetails({ isTour, distance, eta, route, onClose }: { isTour: boolean; distance: string | null; eta: number | null; route: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog className="along-home-details" ref={dialog} onCancel={onClose} aria-labelledby="journey-details-title">
    <button className="along-home-details-close" onClick={onClose} aria-label="Close details"><X size={22} /></button>
    <h2 id="journey-details-title">{isTour ? "Your practice journey" : "Journey details"}</h2>
    <p>{distance ?? "Distance unavailable"}</p><p>{eta != null ? `${eta} min estimated arrival` : "ETA unavailable"}</p>
    <p>{isTour ? "Simulated locations and timing. No real request or location is shared." : route ? "Route provided by your journey service." : "Route unavailable."}</p>
    <button className="along-home-primary" onClick={onClose}>Back to map<ArrowRight size={20} /></button>
  </dialog>;
}

export function HomeNavigation({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items = [{ id: "ride", label: "Home", Icon: House }, { id: "requests", label: "Requests", Icon: PaperPlaneTilt }, { id: "us", label: "Together", Icon: Heart }, { id: "profile", label: "You", Icon: UserCircle }] as const;
  return <nav className="along-floating-nav" aria-label="Main navigation">{items.map(({ id, label, Icon }) => <button key={id} aria-current={active === id ? "page" : undefined} onClick={() => onChange(id)}><span><Icon size={24} weight={active === id ? "fill" : "regular"} /></span>{label}</button>)}</nav>;
}
