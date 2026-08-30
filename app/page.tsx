"use client";
/* eslint-disable @next/next/no-img-element -- fixed local avatar asset; avoids Vinext next/image duplicate-renderer issue */

import {
  AlertTriangle,
  ArrowRight,
  BatteryLow,
  Bell,
  BellRing,
  Bike,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Coffee,
  Crosshair,
  Gauge,
  Gift,
  Heart,
  Home as HomeIcon,
  Info,
  LocateFixed,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Moon,
  Navigation,
  Navigation2,
  Pause,
  Phone,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Route,
  Send,
  ShieldCheck,
  ShoppingBag,
  SignalLow,
  Sparkles,
  TimerReset,
  UserRound,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SpeedSmoother, type SpeedReading } from "./lib/geolocation";
import { realtime } from "./lib/realtime";
import {
  INITIAL_STATE,
  type AppState,
  type EdgeMode,
  type PitStop,
  type RideStage,
  type Role,
  type Tab,
} from "./lib/types";

const quickMessages = [
  "Where are you?",
  "Come soon",
  "Drive safe",
  "I’m outside",
  "5 more minutes",
  "Call me",
  "Hungry",
  "Coffee?",
  "Home please",
];

const requestKinds: Array<{ kind: PitStop["kind"]; title: string; detail: string; emoji: string }> = [
  { kind: "chocolate", title: "Chocolate", detail: "A little sweet stop", emoji: "🍫" },
  { kind: "coffee", title: "Coffee", detail: "Before or on the way", emoji: "☕" },
  { kind: "flowers", title: "Flowers", detail: "Pick a tiny bunch", emoji: "🌼" },
  { kind: "drink", title: "Grab a drink", detail: "Something cold", emoji: "🥤" },
  { kind: "medicine", title: "Medicine", detail: "Pharmacy stop", emoji: "💊" },
  { kind: "grocery", title: "Grocery", detail: "Quick essentials", emoji: "🛍️" },
  { kind: "stop", title: "Add a stop", detail: "Somewhere on the route", emoji: "📍" },
  { kind: "custom", title: "Something else", detail: "Write a quick note", emoji: "✨" },
];

const places = [
  { title: "Home", address: "Defence Colony, Indiranagar", icon: HomeIcon },
  { title: "Work", address: "Embassy Golf Links, Domlur", icon: ShoppingBag },
  { title: "Third Wave Coffee", address: "12th Main Road", icon: Coffee },
];

const stageLabel: Record<RideStage, string> = {
  idle: "Available",
  requested: "Request sent",
  accepted: "Ride accepted",
  enroute: "On the way",
  nearby: "Almost there",
  arrived: "At pickup",
  active: "Together",
  paused: "Coffee break",
  complete: "Ride complete",
  declined: "Can’t make it",
  timedout: "No response",
  cancelled: "Ride cancelled",
};

type Modal = "none" | "book" | "destination" | "messages" | "demo" | "pitstop" | "cancel";

type InstallPrompt = Event & { prompt: () => Promise<void> };

const SASI_PROFILE_PHOTO = "/sasi-profile.png";

const formatAge = (timestamp: number, edgeMode: EdgeMode) => {
  if (edgeMode === "stale") return "12 min ago";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  return seconds < 10 ? "just now" : `${seconds}s ago`;
};

function useLiveSpeed(active: boolean, edgeMode: EdgeMode) {
  const [reading, setReading] = useState<SpeedReading>({
    speedKmh: null,
    accuracy: null,
    source: "unavailable",
    lastUpdated: null,
  });
  const [permission, setPermission] = useState<"prompt" | "granted" | "denied" | "unavailable">("prompt");
  const smoother = useRef(new SpeedSmoother());

  useEffect(() => {
    if (!active || !navigator.geolocation || edgeMode === "gps-denied") {
      // This mirrors an external browser capability into the UI.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!navigator.geolocation) setPermission("unavailable");
      if (edgeMode === "gps-denied") setPermission("denied");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setPermission("granted");
        if (edgeMode === "gps-low") {
          setReading({ speedKmh: null, accuracy: 140, source: "unavailable", lastUpdated: Date.now() });
        } else {
          setReading(smoother.current.add(position));
        }
      },
      (error) => setPermission(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active, edgeMode]);

  return { reading, permission };
}

export default function AlongApp() {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [modal, setModal] = useState<Modal>("none");
  const [toast, setToast] = useState("");
  const [selectedKind, setSelectedKind] = useState<PitStop["kind"]>("chocolate");
  const [chocolate, setChocolate] = useState("Dairy Milk Silk");
  const [customRequest, setCustomRequest] = useState("");
  const [pendingDestination, setPendingDestination] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [demoHint, setDemoHint] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const locationActive = state.role === "driver" && state.sharing && state.stage !== "idle";
  const { reading, permission } = useLiveSpeed(locationActive, state.edgeMode);

  useEffect(() => {
    const saved = realtime.load();
    // Hydrate the locally recovered ride only after the browser is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setState({ ...INITIAL_STATE, ...saved, lastUpdated: Date.now() });
    setHydrated(true);
    const install = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", install);
    return () => window.removeEventListener("beforeinstallprompt", install);
  }, []);

  useEffect(() => {
    if (hydrated) realtime.save(state);
  }, [hydrated, state]);

  useEffect(() => {
    const onOnline = () => setState((current) => current.edgeMode === "offline" ? { ...current, edgeMode: "normal", lastUpdated: Date.now() } : current);
    const onOffline = () => setState((current) => ({ ...current, edgeMode: "offline", lastUpdated: Date.now() }));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const patchState = (patch: Partial<AppState>) =>
    setState((current) => ({ ...current, ...patch, lastUpdated: Date.now() }));

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  const addRequest = () => {
    const template = requestKinds.find((item) => item.kind === selectedKind)!;
    const detail =
      selectedKind === "chocolate"
        ? chocolate
        : selectedKind === "custom"
          ? customRequest || "A little surprise"
          : template.detail;
    const item: PitStop = { ...template, detail, id: crypto.randomUUID(), status: "requested" };
    setState((current) => ({ ...current, pitStops: [...current.pitStops, item], lastUpdated: Date.now() }));
    setModal("none");
    notify(`${template.title} request sent to ${state.role === "rider" ? "Sasi" : "Monu"}`);
  };

  const setStage = (stage: RideStage, message?: string) => {
    patchState({ stage, sharing: stage !== "idle" && stage !== "complete" && stage !== "cancelled" });
    if (message) notify(message);
  };

  const resetRide = () => {
    setState((current) => ({
      ...INITIAL_STATE,
      role: current.role,
      activeTab: "ride",
      driverOnline: current.driverOnline,
      appearance: current.appearance,
    }));
    setModal("none");
  };

  const sendMessage = (message: string) => {
    setModal("none");
    notify(`“${message}” sent`);
  };

  const switchRole = (role: Role) => {
    patchState({ role, activeTab: "ride" });
    setModal("none");
    notify(`Previewing ${role} view`);
  };

  const startRequest = () => {
    if (!state.driverOnline) {
      notify("Sasi is offline — we’ll let you know when he’s back");
      return;
    }
    if (state.edgeMode === "gps-denied") {
      notify("Location access is needed to set your pickup");
      return;
    }
    setPendingDestination(state.destination);
    setModal("book");
  };

  const submitRide = () => {
    if (state.stage !== "idle" && !["declined", "timedout", "cancelled", "complete"].includes(state.stage)) {
      notify("You already have a ride in progress");
      return;
    }
    patchState({ destination: pendingDestination, stage: "requested", sharing: false, riderReady: false });
    setModal("none");
    notify("Ride request sent to Sasi");
  };

  const callPartner = () => {
    if (window.matchMedia("(pointer: coarse)").matches) window.location.href = "tel:+910000000000";
    else notify("Calling is available when you open Along on your phone");
  };

  const navItems: Array<{ id: Tab; label: string; Icon: typeof HomeIcon }> = [
    { id: "ride", label: "Ride", Icon: HomeIcon },
    { id: "requests", label: "Requests", Icon: Gift },
    { id: "us", label: "Us", Icon: Heart },
    { id: "profile", label: "Profile", Icon: UserRound },
  ];

  const isRideLive = ["requested", "accepted", "enroute", "nearby", "arrived", "active", "paused"].includes(state.stage);
  const visibleSpeed = state.edgeMode === "gps-low" || state.edgeMode === "stale"
    ? null
    : reading.speedKmh ?? (isRideLive ? 28 : null);
  const age = formatAge(state.lastUpdated, state.edgeMode);

  const driverTitle = useMemo(() => {
    if (!state.driverOnline) return "Sasi is offline";
    if (state.stage === "idle") return "Sasi is 8 min away";
    if (state.stage === "requested") return "Waiting for Sasi";
    if (["accepted", "enroute"].includes(state.stage)) return "Sasi is on the way";
    if (state.stage === "nearby") return "Sasi is around the corner";
    if (state.stage === "arrived") return "Sasi is here";
    if (state.stage === "active") return "You’re on your way";
    if (state.stage === "paused") return "Coffee break";
    if (state.stage === "complete") return "Home safe ♡";
    return stageLabel[state.stage];
  }, [state.driverOnline, state.stage]);

  if (!hydrated) return <main className="app-shell loading-shell" aria-label="Opening Along" />;

  return (
    <main className={`app-shell ${state.appearance === "dark" ? "theme-dark" : ""}`}>
      {toast && <div className="toast"><CheckCircle2 size={17} />{toast}</div>}
      <EdgeBanner mode={state.edgeMode} />

      {state.activeTab === "ride" && (
        <RideScreen
          state={state}
          role={state.role}
          driverTitle={driverTitle}
          age={age}
          visibleSpeed={visibleSpeed}
          reading={reading}
          permission={permission}
          onBrand={() => setModal("demo")}
          onCall={callPartner}
          onMessage={() => setModal("messages")}
          onRequest={() => { setSelectedKind("chocolate"); setModal("pitstop"); }}
          onDestination={() => { setPendingDestination(state.destination); setModal("destination"); }}
          onComeGetMe={startRequest}
          onStage={setStage}
          onCancel={() => setModal("cancel")}
          onReady={() => { patchState({ riderReady: true }); notify("Sasi knows you’re coming downstairs"); }}
          onSharing={() => patchState({ sharing: !state.sharing })}
          onDriverOnline={() => patchState({ driverOnline: !state.driverOnline, sharing: false })}
          onPitStopStatus={(id, status) => setState((current) => ({
            ...current,
            pitStops: current.pitStops.map((item) => item.id === id ? { ...item, status } : item),
            lastUpdated: Date.now(),
          }))}
        />
      )}

      {state.activeTab === "requests" && (
        <RequestsScreen
          requests={state.pitStops}
          onAdd={(kind) => { setSelectedKind(kind); setModal("pitstop"); }}
          onRemove={(id) => setState((current) => ({ ...current, pitStops: current.pitStops.filter((item) => item.id !== id) }))}
        />
      )}

      {state.activeTab === "us" && <UsScreen />}

      {state.activeTab === "profile" && (
        <ProfileScreen
          state={state}
          permission={permission}
          installPrompt={installPrompt}
          onInstall={async () => {
            if (installPrompt) await installPrompt.prompt();
            else notify("On iPhone, use Share → Add to Home Screen");
          }}
          onPatch={patchState}
          onDemo={() => setModal("demo")}
        />
      )}

      <nav className="bottom-nav" aria-label="Main navigation">
        {navItems.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={state.activeTab === id ? "active" : ""}
            onClick={() => patchState({ activeTab: id })}
            aria-current={state.activeTab === id ? "page" : undefined}
          >
            <span className="nav-icon"><Icon size={20} strokeWidth={state.activeTab === id ? 2.6 : 2} /></span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {modal !== "none" && (
        <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModal("none")}>
          <div className={`modal-sheet ${modal === "demo" ? "demo-sheet" : ""}`} role="dialog" aria-modal="true">
            <div className="modal-handle" />
            <button className="close-button" onClick={() => setModal("none")} aria-label="Close"><X size={19} /></button>

            {modal === "book" && (
              <BookingModal
                destination={pendingDestination}
                pitStops={state.pitStops}
                onDestination={() => setModal("destination")}
                onSubmit={submitRide}
              />
            )}

            {modal === "destination" && (
              <DestinationModal
                value={pendingDestination}
                onChange={setPendingDestination}
                onSelect={(value) => { setPendingDestination(value); if (state.stage === "active") { patchState({ destination: value }); notify("Destination updated for Sasi"); setModal("none"); } else setModal("book"); }}
              />
            )}

            {modal === "messages" && <MessagesModal onSend={sendMessage} />}

            {modal === "pitstop" && (
              <PitStopModal
                kind={selectedKind}
                chocolate={chocolate}
                custom={customRequest}
                onKind={setSelectedKind}
                onChocolate={setChocolate}
                onCustom={setCustomRequest}
                onAdd={addRequest}
                duringRide={isRideLive}
              />
            )}

            {modal === "cancel" && (
              <CancelModal
                stage={state.stage}
                onKeep={() => setModal("none")}
                onCancel={() => { setStage("cancelled", "Ride cancelled — Sasi has been notified"); setModal("none"); }}
              />
            )}

            {modal === "demo" && (
              <DemoModal
                state={state}
                onRole={switchRole}
                onStage={(stage) => patchState({ stage, sharing: !["idle", "requested", "complete", "cancelled"].includes(stage) })}
                onEdge={(edgeMode) => patchState({ edgeMode })}
                onReset={resetRide}
                hint={demoHint}
                onHint={() => setDemoHint(true)}
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function EdgeBanner({ mode }: { mode: EdgeMode }) {
  if (mode === "normal") return null;
  const config: Record<Exclude<EdgeMode, "normal">, { icon: typeof WifiOff; title: string; detail: string }> = {
    offline: { icon: WifiOff, title: "You’re offline", detail: "Keeping the last location on screen" },
    weak: { icon: SignalLow, title: "Weak connection", detail: "Updates may take a little longer" },
    stale: { icon: TimerReset, title: "Location is out of date", detail: "Last update was 12 min ago" },
    "gps-low": { icon: Crosshair, title: "Low GPS accuracy", detail: "Sasi’s location is approximate" },
    "gps-denied": { icon: LockKeyhole, title: "Location is off", detail: "Allow access to use live pickup" },
    "map-failed": { icon: AlertTriangle, title: "Map couldn’t load", detail: "Ride details are still available" },
    backgrounded: { icon: BatteryLow, title: "Updates may pause", detail: "Keep Along open during the ride" },
  };
  const item = config[mode as Exclude<EdgeMode, "normal">];
  const Icon = item.icon;
  return <div className="edge-banner"><Icon size={16} /><span><strong>{item.title}</strong>{item.detail}</span></div>;
}

type RideProps = {
  state: AppState;
  role: Role;
  driverTitle: string;
  age: string;
  visibleSpeed: number | null;
  reading: SpeedReading;
  permission: string;
  onBrand: () => void;
  onCall: () => void;
  onMessage: () => void;
  onRequest: () => void;
  onDestination: () => void;
  onComeGetMe: () => void;
  onStage: (stage: RideStage, message?: string) => void;
  onCancel: () => void;
  onReady: () => void;
  onSharing: () => void;
  onDriverOnline: () => void;
  onPitStopStatus: (id: string, status: PitStop["status"]) => void;
};

function RideScreen(props: RideProps) {
  const { state, role } = props;
  return (
    <section className="screen ride-screen">
      <DemoMap state={state} role={role} onBrand={props.onBrand} />
      <section className="ride-sheet">
        <div className="sheet-handle" />
        {role === "rider" ? <RiderRidePanel {...props} /> : <DriverRidePanel {...props} />}
      </section>
    </section>
  );
}

function DemoMap({ state, role, onBrand }: { state: AppState; role: Role; onBrand: () => void }) {
  const moving = ["accepted", "enroute", "nearby", "active"].includes(state.stage);
  const routeVisible = state.stage !== "idle" && state.stage !== "declined" && state.stage !== "cancelled";
  return (
    <div className={`map-stage map-${state.edgeMode}`} aria-label="Live location map">
      {state.edgeMode === "map-failed" ? (
        <div className="map-fallback"><div><MapPin size={30} /><strong>Map view unavailable</strong><span>Pickup: {state.pickup}</span><small>2.4 km · about 8 min away</small></div></div>
      ) : (
        <>
          <div className="map-grid" />
          <div className="park park-one" /><div className="park park-two" />
          <div className="road road-a" /><div className="road road-b" /><div className="road road-c" /><div className="road road-d" />
          <span className="road-name road-name-a">100 Feet Rd</span><span className="road-name road-name-b">12th Main</span><span className="area-name">INDIRANAGAR</span>
          {routeVisible && <div className={`route-path ${moving ? "moving" : ""}`}><i /><i /><i /><i /><i /><i /><i /></div>}
          <div className={`map-person rider-map-marker ${role === "rider" ? "is-me" : ""}`}><span>{role === "rider" ? "You" : "Monu"}</span></div>
          <div className={`map-person driver-map-marker ${moving ? "marker-moving" : ""} ${role === "driver" ? "is-me" : ""}`}><div className="sasi-avatar-crop sasi-map-photo"><img src={SASI_PROFILE_PHOTO} alt="Sasi" width={48} height={48} /></div><span>{role === "driver" ? "You" : "Sasi"}</span></div>
          {state.stage === "active" && <div className="destination-pin"><MapPin size={18} /><span>{state.destination || "Home"}</span></div>}
        </>
      )}

      <header className="map-header">
        <button className="avatar-button" aria-label="Open Sasi profile"><span className="sasi-avatar-crop sasi-header-photo"><img src={SASI_PROFILE_PHOTO} alt="Sasi" width={88} height={88} /></span><i /></button>
        <button className="wordmark" onClick={onBrand} aria-label="Open preview controls"><span>A</span>along</button>
        <button className="icon-button notification-button" aria-label="Notifications"><Bell size={20} /><i>2</i></button>
      </header>

      <div className={`sharing-chip ${state.sharing ? "is-sharing" : ""}`}><Radio size={13} />{state.sharing ? (role === "rider" ? "Sasi is sharing location" : "Location shared with her") : state.stage === "idle" || state.stage === "requested" ? (role === "rider" ? "Sasi shared 2 min ago" : "Normal mode · not sharing") : "Location sharing paused"}</div>
      <button className="locate-button" aria-label="Center map"><LocateFixed size={21} /></button>
      <div className="map-provider">DEMO MAP</div>
    </div>
  );
}

function RiderRidePanel(props: RideProps) {
  const { state } = props;
  if (state.stage === "requested") {
    return (
      <div className="state-panel waiting-panel">
        <div className="waiting-orbit"><Bike size={26} /><i /></div>
        <span className="status-kicker warm">REQUEST SENT</span>
        <h1>Asking Sasi…</h1>
        <p>We’ll keep this screen ready when he responds.</p>
        <div className="request-summary"><MapPin size={17} /><span><strong>Pickup now</strong>{state.pickup}</span></div>
        <button className="text-button danger" onClick={props.onCancel}>Cancel request</button>
      </div>
    );
  }

  if (["declined", "timedout", "cancelled"].includes(state.stage)) {
    const copy = state.stage === "declined" ? ["Sasi can’t make it", "He sent: “I’m stuck right now. I’ll call you.”"] : state.stage === "timedout" ? ["Sasi didn’t answer", "Your request expired after two minutes."] : ["Ride cancelled", "No location is being shared for this ride."];
    return (
      <div className="state-panel result-panel">
        <div className="result-icon"><Info size={24} /></div><h1>{copy[0]}</h1><p>{copy[1]}</p>
        <button className="primary-button" onClick={props.onComeGetMe}>Try again <ArrowRight size={18} /></button>
      </div>
    );
  }

  if (state.stage === "complete") {
    return (
      <div className="state-panel complete-panel">
        <div className="complete-icon"><Heart size={25} fill="currentColor" /></div>
        <span className="status-kicker">RIDE COMPLETE</span><h1>Home safe ♡</h1><p>8.6 km together · 34 min · 1 chocolate stop</p>
        <div className="complete-stats"><span><b>24</b>rides</span><span><b>184</b>km</span><span><b>12</b>treats</span></div>
        <button className="secondary-button" onClick={() => props.onStage("idle")}>Back to home</button>
      </div>
    );
  }

  const inMotion = ["accepted", "enroute", "nearby", "arrived", "active", "paused"].includes(state.stage);
  return (
    <div className="rider-panel">
      <div className="partner-status-row">
        <div>
          <span className={`status-kicker ${state.driverOnline ? "available" : "offline"}`}><i />{state.driverOnline ? stageLabel[state.stage] : "Offline"}</span>
          <h1>{props.driverTitle}</h1>
          <p>{state.driverOnline ? `2.4 km · updated ${props.age}` : "Last shared 46 min ago"}</p>
        </div>
        <div className={`speed-card ${props.visibleSpeed == null ? "unavailable" : ""}`} title={props.reading.source === "calculated" ? "Calculated from recent GPS points" : "GPS speed"}>
          <Gauge size={14} /><strong>{props.visibleSpeed ?? "—"}</strong><span>{props.visibleSpeed == null ? "unavailable" : "km/h"}</span>
        </div>
      </div>

      {state.edgeMode === "stale" && <div className="inline-alert"><TimerReset size={16} /><span><strong>Location may be out of date</strong>Last seen near Domlur Flyover.</span></div>}

      {state.stage === "idle" && (
        <>
          <div className="quick-actions">
            <button onClick={() => props.onStage("idle", "Centered on Sasi’s last location")}><span><Navigation2 /></span>Find him</button>
            <button onClick={props.onDestination}><span><MapPin /></span>Where to?</button>
            <button onClick={props.onCall}><span><Phone /></span>Call</button>
            <button onClick={props.onRequest}><span><Plus /></span>Request</button>
          </div>
          <button className="come-button" onClick={props.onComeGetMe} disabled={!state.driverOnline}><span>{state.driverOnline ? "Come get me" : "Sasi is offline"}<small>{state.driverOnline ? "Pickup from your current location" : "We’ll let you know when he’s back"}</small></span><i><ArrowRight size={20} /></i></button>
          <button className="destination-link" onClick={props.onDestination}><MapPin size={14} />{state.destination || "Add a destination now or decide together"}<ChevronRight size={15} /></button>
        </>
      )}

      {inMotion && (
        <div className="live-ride-content">
          <RideTimeline stage={state.stage} />
          {state.destination && <div className="route-summary"><div><i /><span><small>Pickup</small>{state.pickup}</span></div><div><b /><span><small>Destination</small>{state.destination}</span></div></div>}
          {state.pitStops.length > 0 && (
            <div className="active-requests">
              {state.pitStops.map((item) => <div key={item.id}><span>{item.emoji}</span><p><strong>{item.title}</strong>{item.detail}</p><em className={`request-status ${item.status}`}>{item.status === "secured" ? "Secured" : item.status}</em></div>)}
            </div>
          )}
          {["accepted", "enroute", "nearby"].includes(state.stage) && (
            <>
              <div className="message-scroll">{quickMessages.slice(0, 5).map((message) => <button key={message} onClick={() => props.onStage(state.stage, `“${message}” sent`)}>{message}</button>)}</div>
              <div className="ride-action-row"><button onClick={props.onCall}><Phone size={18} />Call</button><button onClick={props.onMessage}><MessageCircle size={18} />Message</button><button onClick={props.onRequest}><Gift size={18} />Add request</button></div>
              {state.stage === "nearby" && <button className="primary-button" onClick={() => props.onStage("arrived", "Sasi knows you saw the arrival")}>He’s here <ArrowRight size={18} /></button>}
              <button className="text-button danger" onClick={props.onCancel}>Cancel ride</button>
            </>
          )}
          {state.stage === "arrived" && (
            <div className="arrival-card"><span className="arrival-emoji">👋</span><h2>Sasi is waiting outside</h2><p>White Ather · KA 03 MX 4242</p><button className="primary-button" disabled={state.riderReady} onClick={props.onReady}>{state.riderReady ? <><Check size={18} /> Coming downstairs</> : <>I’m coming downstairs <ArrowRight size={18} /></>}</button><button className="text-button" onClick={props.onMessage}>Send a message</button></div>
          )}
          {["active", "paused"].includes(state.stage) && (
            <div className="active-controls"><div className="arrival-strip"><span>{state.stage === "paused" ? "Coffee break" : "Arrive in 18 min"}</span><b>{state.destination || "Decide together"}</b></div><div className="ride-action-row"><button onClick={props.onDestination}><Route size={18} />Change</button><button onClick={props.onRequest}><Plus size={18} />Add stop</button><button onClick={props.onCall}><Phone size={18} />Call</button></div></div>
          )}
        </div>
      )}
    </div>
  );
}

function DriverRidePanel(props: RideProps) {
  const { state } = props;
  if (state.stage === "requested") {
    return (
      <div className="incoming-panel">
        <div className="incoming-top"><div className="rider-avatar">M<span /></div><div><span className="status-kicker warm">NEW RIDE REQUEST</span><h1>Monu needs a ride</h1><p>Received just now · 2.4 km away</p></div></div>
        <div className="pickup-card"><div><i /><span><small>Pick up</small>{state.pickup}</span></div><div><b /><span><small>Then</small>{state.destination || "Destination not set yet"}</span></div></div>
        {state.pitStops.length > 0 && <div className="request-preview"><span>{state.pitStops[0].emoji}</span><p><strong>{state.pitStops[0].title} requested</strong>{state.pitStops[0].detail}</p></div>}
        <div className="decision-row"><button onClick={() => props.onStage("declined", "Monu has been told you can’t make it")}>Can’t make it</button><button className="primary-button" onClick={() => props.onStage("enroute", "Ride accepted — location sharing is on")}>Accept <ArrowRight size={18} /></button></div>
      </div>
    );
  }

  if (state.stage === "complete") {
    return <div className="state-panel complete-panel"><div className="complete-icon"><Check size={27} /></div><span className="status-kicker">DONE FOR TODAY</span><h1>She’s there safely</h1><p>8.6 km · 34 min · good ride.</p><button className="secondary-button" onClick={() => props.onStage("idle")}>Back online</button></div>;
  }

  if (["declined", "cancelled", "timedout"].includes(state.stage)) {
    return <div className="state-panel result-panel"><div className="result-icon"><Info size={24} /></div><h1>{state.stage === "cancelled" ? "Ride cancelled" : "Request closed"}</h1><p>No active location sharing for this ride.</p><button className="primary-button" onClick={() => props.onStage("idle")}>Return home</button></div>;
  }

  return (
    <div className="driver-panel">
      <div className="driver-header-row">
        <div><span className={`status-kicker ${state.driverOnline ? "available" : "offline"}`}><i />{state.driverOnline ? stageLabel[state.stage] : "You’re offline"}</span><h1>{state.stage === "idle" ? (state.driverOnline ? "Ready when she is" : "Taking a break") : props.driverTitle.replace("Sasi", "You")}</h1><p>{state.stage === "idle" ? "Monu is 2.4 km away · Indiranagar" : `Location shared · updated ${props.age}`}</p></div>
        {state.stage === "idle" ? <button className={`online-toggle ${state.driverOnline ? "on" : ""}`} onClick={props.onDriverOnline}><span />{state.driverOnline ? "Online" : "Offline"}</button> : <div className="speed-card"><Gauge size={14} /><strong>{props.visibleSpeed ?? "—"}</strong><span>km/h</span></div>}
      </div>

      {state.stage === "idle" && (
        <><div className="rider-nearby-card"><div className="rider-avatar">M<span /></div><div><strong>Monu</strong><p>At Home · shared 1 min ago</p></div><button onClick={props.onCall}><Phone size={18} /></button></div><div className="privacy-card"><ShieldCheck size={19} /><span><strong>Normal sharing mode</strong>Your precise location isn’t being tracked continuously.</span></div></>
      )}

      {["accepted", "enroute", "nearby", "arrived"].includes(state.stage) && (
        <div className="driver-navigation">
          <div className="next-turn"><div><Navigation size={27} /></div><span><small>IN 300 M</small>Turn right onto 12th Main</span></div>
          <div className="driver-trip-meta"><span><strong>{state.stage === "arrived" ? "0" : "8"} min</strong>to Monu</span><span><strong>{state.stage === "arrived" ? "0" : "2.4"} km</strong>remaining</span><span><strong>12:48</strong>arrival</span></div>
          {state.pitStops.map((item) => (
            <div className="driver-request-card" key={item.id}><span>{item.emoji}</span><p><strong>{item.title}</strong>{item.detail}</p>{item.status === "requested" ? <div><button onClick={() => props.onPitStopStatus(item.id, "unavailable")}><X size={16} /></button><button className="done" onClick={() => props.onPitStopStatus(item.id, "secured")}><Check size={16} /></button></div> : <em className={`request-status ${item.status}`}>{item.status}</em>}</div>
          ))}
          {state.stage !== "arrived" ? <button className="primary-button" onClick={() => props.onStage("arrived", "Monu has been told you arrived")}>I’ve arrived <ArrowRight size={18} /></button> : <button className="primary-button" disabled={!state.riderReady} onClick={() => props.onStage("active", "Ride started")}>{state.riderReady ? <>Start ride <ArrowRight size={18} /></> : "Waiting for Monu…"}</button>}
          <div className="driver-secondary"><button onClick={props.onCall}><Phone size={17} />Call Monu</button><button onClick={props.onMessage}><MessageCircle size={17} />Message</button></div>
          <button className="text-button danger" onClick={props.onCancel}>Cancel ride</button>
        </div>
      )}

      {["active", "paused"].includes(state.stage) && (
        <div className="driver-navigation">
          <div className="next-turn active-turn"><div><Navigation size={27} /></div><span><small>{state.stage === "paused" ? "PAUSED" : "IN 500 M"}</small>{state.stage === "paused" ? "Coffee break in progress" : "Keep left toward Domlur"}</span></div>
          <div className="driver-trip-meta"><span><strong>18 min</strong>arrival</span><span><strong>8.6 km</strong>remaining</span><span><strong>1</strong>stop</span></div>
          <div className="sharing-control"><Radio size={17} /><span><strong>Location shared with her</strong>Stops automatically when this ride ends.</span><button onClick={props.onSharing}>{state.sharing ? "Stop" : "Resume"}</button></div>
          <div className="ride-control-row"><button onClick={() => props.onStage(state.stage === "paused" ? "active" : "paused", state.stage === "paused" ? "Ride resumed" : "Coffee break started")}>{state.stage === "paused" ? <><Play size={20} />Resume</> : <><Pause size={20} />Coffee break</>}</button><button className="end-ride" onClick={() => props.onStage("complete", "Ride complete — sharing stopped")}><Check size={20} />End ride</button></div>
        </div>
      )}
    </div>
  );
}

function RideTimeline({ stage }: { stage: RideStage }) {
  const steps = ["accepted", "enroute", "nearby", "arrived", "active"];
  const activeIndex = Math.max(0, steps.indexOf(stage === "paused" ? "active" : stage));
  return <div className="ride-timeline">{steps.map((step, index) => <span key={step} className={index <= activeIndex ? "done" : ""}><i />{step === "enroute" ? "On the way" : step === "nearby" ? "Near you" : step === "active" ? "Together" : step}</span>)}</div>;
}

function RequestsScreen({ requests, onAdd, onRemove }: { requests: PitStop[]; onAdd: (kind: PitStop["kind"]) => void; onRemove: (id: string) => void }) {
  return (
    <section className="screen content-screen requests-screen">
      <ContentHeader kicker="LITTLE THINGS" title="What should he bring?" subtitle="Add it before pickup or while you’re on the way." />
      <div className="request-grid">{requestKinds.map((item) => <button key={item.kind} onClick={() => onAdd(item.kind)}><span>{item.emoji}</span><strong>{item.title}</strong><small>{item.detail}</small><i><Plus size={16} /></i></button>)}</div>
      <div className="section-heading"><div><span>THIS RIDE</span><h2>Your requests</h2></div><em>{requests.length}</em></div>
      {requests.length ? <div className="request-list">{requests.map((item) => <div key={item.id}><span>{item.emoji}</span><p><strong>{item.title}</strong>{item.detail}</p><em className={`request-status ${item.status}`}>{item.status}</em><button onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title}`}><X size={16} /></button></div>)}</div> : <div className="empty-card"><Sparkles size={22} /><strong>Nothing extra yet</strong><span>Your requests will stay here during the ride.</span></div>}
      <div className="request-note"><Info size={16} /><span>He can mark an item secured or unavailable. You’ll always see the update.</span></div>
    </section>
  );
}

function UsScreen() {
  return (
    <section className="screen content-screen us-screen">
      <ContentHeader kicker="SINCE NOVEMBER 2024" title="184 km, just us." subtitle="The routes, treats, and little detours you made together." />
      <div className="us-hero">
        <div className="memory-map"><div className="memory-road a" /><div className="memory-road b" /><div className="memory-road c" /><span className="memory-pin one">⌂</span><span className="memory-pin two">☕</span><span className="memory-pin three">♡</span><div className="memory-route" /></div>
        <div className="us-stats"><span><strong>24</strong>rides together</span><span><strong>184</strong>kilometres</span><span><strong>12</strong>treat stops</span></div>
      </div>
      <div className="section-heading"><div><span>OUR FAVOURITES</span><h2>Always worth the detour</h2></div></div>
      <div className="favorite-places"><div className="place-card sunset"><span>01</span><div><small>SUNDAY PLACE</small><strong>Ulsoor Lake</strong><p>4 rides · last visited Aug 18</p></div></div><div className="place-card night"><span>02</span><div><small>COFFEE PLACE</small><strong>Blue Tokai</strong><p>7 stops · our usual table</p></div></div></div>
      <div className="section-heading"><div><span>RECENT MEMORY</span><h2>Rain ride to Church Street</h2></div><button>See all</button></div>
      <article className="memory-card"><div className="memory-art"><span>JUL<br/>27</span><i>☂</i></div><div><strong>“Best filter coffee after the rain.”</strong><p>Church Street · 11.2 km · 48 min</p><div className="memory-chips"><span>☕ 1 coffee</span><span>🍫 Silk</span></div></div></article>
    </section>
  );
}

type ProfileProps = { state: AppState; permission: string; installPrompt: InstallPrompt | null; onInstall: () => void; onPatch: (patch: Partial<AppState>) => void; onDemo: () => void };
function ProfileScreen({ state, permission, installPrompt, onInstall, onPatch, onDemo }: ProfileProps) {
  const [notifications, setNotifications] = useState(true);
  return (
    <section className="screen content-screen profile-screen">
      <ContentHeader kicker="YOUR SPACE" title="Monu" subtitle="Private by design. Only you and Sasi are here." />
      <div className="partner-card"><div className="partner-avatars"><span>M</span><i>♡</i><span className="partner-photo"><img src={SASI_PROFILE_PHOTO} alt="Sasi" width={128} height={128} /></span></div><div><small>YOUR PARTNER</small><strong>Sasi</strong><p>Driver · White Ather 450X</p></div><button><Phone size={18} /></button></div>
      <div className="settings-group"><h3>Places & rides</h3><SettingsRow Icon={MapPin} title="Saved places" detail="Home, Work, 3 more" /><SettingsRow Icon={Route} title="Ride history" detail="24 rides together" /><SettingsRow Icon={Users} title="Emergency contacts" detail="2 people" /></div>
      <div className="settings-group"><h3>Privacy & safety</h3><SettingsRow Icon={Radio} title="Live location" detail={state.sharing ? "Shared during active rides" : "Sharing is paused"} control={<Toggle on={state.sharing} onClick={() => onPatch({ sharing: !state.sharing })} />} /><SettingsRow Icon={Crosshair} title="Location permission" detail={permission === "granted" ? "Precise location allowed" : permission === "denied" ? "Permission denied" : "Ask when needed"} /><SettingsRow Icon={ShieldCheck} title="Privacy promise" detail="Never tracked silently or 24/7" /></div>
      <div className="settings-group"><h3>App</h3><SettingsRow Icon={BellRing} title="Notifications" detail="Ride and request updates" control={<Toggle on={notifications} onClick={() => setNotifications(!notifications)} />} /><SettingsRow Icon={Moon} title="Appearance" detail={state.appearance === "light" ? "Soft light" : "Night ride"} control={<Toggle on={state.appearance === "dark"} onClick={() => onPatch({ appearance: state.appearance === "light" ? "dark" : "light" })} />} /><button className="setting-row" onClick={onInstall}><span className="setting-icon"><Navigation size={18} /></span><span><strong>{installPrompt ? "Install Along" : "Add to Home Screen"}</strong><small>Faster launch, full-screen feel</small></span><ChevronRight size={17} /></button><SettingsRow Icon={Info} title="About Along" detail="Made for two · v1.0" /></div>
      <div className="web-limit-note"><BatteryLow size={18} /><p><strong>A note about background tracking</strong>Mobile web browsers—especially iPhone when locked—can pause location updates. For the freshest location, keep Along open during an active ride.</p></div>
      <button className="version-button" onClick={onDemo}>Along demo controls · build 1.0</button>
    </section>
  );
}

function SettingsRow({ Icon, title, detail, control }: { Icon: typeof MapPin; title: string; detail: string; control?: React.ReactNode }) {
  return <div className="setting-row"><span className="setting-icon"><Icon size={18} /></span><span><strong>{title}</strong><small>{detail}</small></span>{control || <ChevronRight size={17} />}</div>;
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) { return <button className={`toggle ${on ? "on" : ""}`} onClick={onClick} aria-pressed={on}><i /></button>; }

function ContentHeader({ kicker, title, subtitle }: { kicker: string; title: string; subtitle: string }) {
  return <header className="content-header"><div className="content-top"><div className="mini-wordmark"><span>A</span>along</div><button className="icon-button"><Bell size={19} /></button></div><span>{kicker}</span><h1>{title}</h1><p>{subtitle}</p></header>;
}

function BookingModal({ destination, pitStops, onDestination, onSubmit }: { destination: string; pitStops: PitStop[]; onDestination: () => void; onSubmit: () => void }) {
  return <div className="booking-modal"><span className="modal-kicker">YOUR RIDE</span><h2>Come get me</h2><p>Sasi will receive your current pickup and anything you need on the way.</p><div className="booking-route"><div><i /><span><small>PICKUP NOW</small>Indiranagar · your location</span></div><button onClick={onDestination}><b /><span><small>DESTINATION · OPTIONAL</small>{destination || "Where are you going?"}</span><ChevronRight size={17} /></button></div>{pitStops.length > 0 && <div className="booking-requests"><span>{pitStops.map((item) => item.emoji).join(" ")}</span><p><strong>{pitStops.length} request{pitStops.length > 1 ? "s" : ""} attached</strong>Sasi can confirm each one</p></div>}<div className="privacy-inline"><ShieldCheck size={17} /><span>Live sharing starts after Sasi accepts.</span></div><button className="primary-button" onClick={onSubmit}>Send to Sasi <ArrowRight size={18} /></button><small className="modal-footnote">No destination needed. You can decide together later.</small></div>;
}

function DestinationModal({ value, onChange, onSelect }: { value: string; onChange: (value: string) => void; onSelect: (value: string) => void }) {
  return <div className="destination-modal"><span className="modal-kicker">DESTINATION</span><h2>Where to?</h2><div className="search-box"><MapPin size={19} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search a place or address" aria-label="Search a place or address" /><button onClick={() => value && onSelect(value)} aria-label="Use this destination"><ArrowRight size={17} /></button></div><button className="current-location" onClick={() => onSelect("")}><Crosshair size={18} /><span><strong>Choose on the way</strong>Keep destination open for now</span><ChevronRight size={17} /></button><h3>Saved places</h3><div className="places-list">{places.map(({ title, address, icon: Icon }) => <button key={title} onClick={() => onSelect(`${title} · ${address}`)}><span><Icon size={18} /></span><p><strong>{title}</strong>{address}</p><ChevronRight size={16} /></button>)}</div></div>;
}

function MessagesModal({ onSend }: { onSend: (message: string) => void }) {
  const [message, setMessage] = useState("");
  return <div className="messages-modal"><span className="modal-kicker">QUICK MESSAGE</span><h2>Tell Sasi</h2><div className="message-grid">{quickMessages.map((item) => <button key={item} onClick={() => onSend(item)}>{item}</button>)}</div><div className="message-input"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write something…" /><button disabled={!message} onClick={() => onSend(message)}><Send size={17} /></button></div></div>;
}

function PitStopModal({ kind, chocolate, custom, onKind, onChocolate, onCustom, onAdd, duringRide }: { kind: PitStop["kind"]; chocolate: string; custom: string; onKind: (kind: PitStop["kind"]) => void; onChocolate: (value: string) => void; onCustom: (value: string) => void; onAdd: () => void; duringRide: boolean }) {
  const template = requestKinds.find((item) => item.kind === kind)!;
  return <div className="pitstop-modal"><span className="modal-kicker">{duringRide ? "ADD TO THIS RIDE" : "ASK AHEAD"}</span><h2>A little stop?</h2><div className="kind-scroll">{requestKinds.map((item) => <button key={item.kind} className={kind === item.kind ? "active" : ""} onClick={() => onKind(item.kind)}><span>{item.emoji}</span>{item.title}</button>)}</div><div className="request-detail-hero"><span>{template.emoji}</span><div><small>REQUESTING</small><strong>{template.title}</strong><p>{template.detail}</p></div></div>{kind === "chocolate" && <div className="choice-chips"><span className="choice-label">Choose one</span>{["Dairy Milk Silk", "KitKat", "Ferrero Rocher", "Surprise me"].map((item) => <button key={item} className={chocolate === item ? "active" : ""} onClick={() => onChocolate(item)}>{item}</button>)}</div>}{kind === "coffee" && <div className="choice-chips"><span className="choice-label">When?</span>{["Before pickup", "During our ride", "Your call"].map((item) => <button key={item}>{item}</button>)}</div>}{kind === "custom" && <textarea value={custom} onChange={(event) => onCustom(event.target.value)} placeholder="What should he bring or do?" aria-label="Custom request" maxLength={100} />}<label className="route-stop-option"><input type="checkbox" defaultChecked={kind !== "custom"} /><span><strong>Add it as a route stop</strong>Sasi can adjust if it’s out of the way.</span></label><button className="primary-button" onClick={onAdd}>Send request <ArrowRight size={18} /></button></div>;
}

function CancelModal({ stage, onKeep, onCancel }: { stage: RideStage; onKeep: () => void; onCancel: () => void }) {
  const enroute = ["accepted", "enroute", "nearby", "arrived"].includes(stage);
  return <div className="cancel-modal"><div className="cancel-icon"><AlertTriangle size={24} /></div><h2>Cancel this ride?</h2><p>{enroute ? "Sasi is already on the way. He’ll be told immediately and location sharing will stop." : "Your request will close and won’t be sent again."}</p><button className="primary-button" onClick={onKeep}>Keep my ride</button><button className="text-button danger" onClick={onCancel}>Yes, cancel ride</button></div>;
}

function DemoModal({ state, onRole, onStage, onEdge, onReset, hint, onHint }: { state: AppState; onRole: (role: Role) => void; onStage: (stage: RideStage) => void; onEdge: (edge: EdgeMode) => void; onReset: () => void; hint: boolean; onHint: () => void }) {
  const stages: RideStage[] = ["idle", "requested", "enroute", "nearby", "arrived", "active", "paused", "complete"];
  const edgeModes: EdgeMode[] = ["normal", "offline", "weak", "stale", "gps-low", "gps-denied", "map-failed", "backgrounded"];
  return <div className="demo-modal"><span className="modal-kicker">PRIVATE PREVIEW TOOL</span><h2>Demo controls</h2><p>Switch sides and jump between realistic ride and connection states. This panel is hidden behind the Along wordmark in the product preview.</p><div className="demo-label">View as</div><div className="segmented"><button className={state.role === "rider" ? "active" : ""} onClick={() => onRole("rider")}><CircleUserRound size={17} />Monu · rider</button><button className={state.role === "driver" ? "active" : ""} onClick={() => onRole("driver")}><Bike size={17} />Sasi · driver</button></div><div className="demo-label">Ride moment</div><div className="demo-chips">{stages.map((stage) => <button key={stage} className={state.stage === stage ? "active" : ""} onClick={() => onStage(stage)}>{stageLabel[stage]}</button>)}</div><div className="demo-label">Edge state</div><div className="demo-chips edge-chips">{edgeModes.map((mode) => <button key={mode} className={state.edgeMode === mode ? "active" : ""} onClick={() => onEdge(mode)}>{mode.replace("gps-", "GPS ").replace("map-", "map ")}</button>)}</div>{!hint ? <button className="demo-tip" onClick={onHint}><Info size={15} />Why these controls?</button> : <div className="demo-explanation">They make every important edge case visible without waiting for a real GPS drop, network failure, or second phone.</div>}<button className="reset-button" onClick={onReset}><RotateCcw size={17} />Reset demo data</button></div>;
}
