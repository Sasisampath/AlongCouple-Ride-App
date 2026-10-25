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
  Store,
  TimerReset,
  UserRound,
  Users,
  WifiOff,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiveMap } from "./components/live-map";
import { IntroExperience } from "./components/intro-experience";
import { SetupFlow, AccountGate, readSetup, type AccountSession } from "./components/setup-flow";
import type { DeviceLocation, SpeedReading } from "./lib/geolocation";
import { useLiveLocation } from "./lib/use-live-location";
import { demoRealtime, realtime } from "./lib/realtime";
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

type Modal = "none" | "book" | "pickup" | "destination" | "messages" | "demo" | "pitstop" | "cancel";

type InstallPrompt = Event & { prompt: () => Promise<void> };

const SASI_PROFILE_PHOTO = "/sasi-profile.png";
const ONBOARDING_KEY = "along.onboarding.v1";

const requestStatusCopy: Record<PitStop["status"], string> = {
  requested: "Waiting",
  secured: "Picked up",
  unavailable: "Couldn’t get it",
};

const formatAge = (timestamp: number, edgeMode: EdgeMode) => {
  if (edgeMode === "stale") return "12 min ago";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  return seconds < 10 ? "just now" : `${seconds}s ago`;
};

export function AlongApp({ demoMode = false, skipWelcome = false, onBackToIntro }: { demoMode?: boolean; skipWelcome?: boolean; onBackToIntro?: () => void } = {}) {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [profileName, setProfileName] = useState("You");
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [accountGate, setAccountGate] = useState<"signin" | "pair" | null>(null);
  const [accountSession, setAccountSession] = useState<AccountSession>({ authenticated: false, signInUrl: null });
  const [modal, setModal] = useState<Modal>("none");
  const [toast, setToast] = useState("");
  const [selectedKind, setSelectedKind] = useState<PitStop["kind"]>("chocolate");
  const [chocolate, setChocolate] = useState("");
  const [customRequest, setCustomRequest] = useState("");
  const [pendingDestination, setPendingDestination] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [demoHint, setDemoHint] = useState(false);
  const [mapFocusSignal, setMapFocusSignal] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateStore = demoMode ? demoRealtime : realtime;

  const isRideLive = ["requested", "accepted", "enroute", "nearby", "arrived", "active", "paused"].includes(state.stage);
  const locationActive = (demoMode || accountSession.authenticated) && isRideLive && (state.role === "rider" || state.sharing);
  const saveDeviceLocation = useCallback((location: DeviceLocation) => {
    setState((current) => {
      const isRider = current.role === "rider";
      const pickup = isRider && (current.pickup === "Choose your pickup location" || current.pickup.startsWith("Your live location"))
        ? `Your live location · ±${location.accuracy} m`
        : current.pickup;
      return {
        ...current,
        pickup,
        [isRider ? "riderLocation" : "driverLocation"]: location,
        lastUpdated: Date.now(),
      };
    });
  }, []);
  const liveLocation = useLiveLocation({
    role: state.role,
    tracking: locationActive,
    edgeMode: state.edgeMode,
    initialLocation: state.role === "rider" ? state.riderLocation : state.driverLocation,
    onLocation: saveDeviceLocation,
  });
  const { reading, permission } = liveLocation;

  useEffect(() => {
    const saved = stateStore.load();
    // Hydrate the locally recovered ride only after the browser is available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setState({ ...INITIAL_STATE, ...saved, lastUpdated: Date.now() });
    const setup = readSetup();
    setProfileAvatar(setup.avatar);
    let previousSetupComplete = false;
    try {
      setProfileName(window.localStorage.getItem("along.profile.name") || "You");
      previousSetupComplete = window.localStorage.getItem(ONBOARDING_KEY) === "complete";
    } catch { /* Setup remains usable when browser storage is unavailable. */ }
    if (!saved && setup.role) setState(current => ({ ...current, role: setup.role! }));
    setOnboardingComplete(demoMode || setup.complete || Boolean(saved) || previousSetupComplete);
    setHydrated(true);
    const install = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", install);
    return () => window.removeEventListener("beforeinstallprompt", install);
  }, [demoMode, stateStore]);

  useEffect(() => {
    // Only the existing hosted environment supplies authenticated headers.
    // Local and Capacitor builds remain guests rather than simulating sign-in.
    if (demoMode || !window.location.hostname.endsWith(".chatgpt.site")) return;
    const abort = new AbortController();
    fetch("/api/account-session", { credentials: "same-origin", signal: abort.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(session => {
        setAccountSession({ authenticated: session.authenticated === true, signInUrl: typeof session.signInUrl === "string" && session.signInUrl.startsWith("/signin-with-chatgpt?") ? session.signInUrl : null });
        if (new URLSearchParams(window.location.search).get("connect") === "partner") setAccountGate(session.authenticated ? "pair" : "signin");
      }).catch(() => {});
    return () => abort.abort();
  }, [demoMode]);

  useEffect(() => {
    if (hydrated && onboardingComplete) stateStore.save(state);
  }, [hydrated, onboardingComplete, state, stateStore]);

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

  const requireAccount = () => {
    if (demoMode) return true;
    setModal("none");
    setAccountGate(accountSession.authenticated ? "pair" : "signin");
    return false;
  };
  const patchState = (patch: Partial<AppState>) => {
    if ((patch.sharing || patch.stage || patch.driverOnline) && !requireAccount()) return;
    setState((current) => ({ ...current, ...patch, lastUpdated: Date.now() }));
  };

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  const addRequest = () => {
    if (!requireAccount()) return;
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
    if (!requireAccount()) return;
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
      riderLocation: current.riderLocation,
      driverLocation: current.driverLocation,
    }));
    setModal("none");
  };

  const sendMessage = (message: string) => {
    if (!requireAccount()) return;
    setModal("none");
    notify(`“${message}” sent`);
  };

  const switchRole = (role: Role) => {
    patchState({ role, activeTab: "ride" });
    setModal("none");
    notify(`Switched to ${role} view`);
  };

  const startRequest = () => {
    if (!requireAccount()) return;
    if (!state.driverOnline) {
      notify("Sasi is offline — we’ll let you know when he’s back");
      return;
    }
    if (state.role === "rider" && !state.riderLocation && state.pickup === "Choose your pickup location") {
      notify("Allow location on the map or choose your pickup manually");
      return;
    }
    setPendingDestination(state.destination);
    setModal("book");
  };

  const submitRide = () => {
    if (!requireAccount()) return;
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

  const visibleSpeed = state.edgeMode === "gps-low" || state.edgeMode === "stale"
    ? null
    : state.role === "driver" ? reading.speedKmh : state.driverLocation?.speedKmh ?? null;
  const partnerTimestamp = state.role === "rider" ? state.driverLocation?.timestamp : state.riderLocation?.timestamp;
  const age = formatAge(partnerTimestamp ?? state.lastUpdated, state.edgeMode);

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

  if (!hydrated || onboardingComplete === null) return <main className="app-shell loading-shell" aria-label="Opening Along" />;

  if (!onboardingComplete) {
    return (
      <SetupFlow
        onComplete={(choice) => {
          try { window.localStorage.setItem(ONBOARDING_KEY, "complete"); } catch { /* In-memory entry works. */ }
          setProfileAvatar(choice.avatar);
          patchState({ role: choice.role || "rider" });
          setOnboardingComplete(true);
        }}
      />
    );
  }

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
          deviceLocation={liveLocation.location}
          locationStatus={liveLocation.status}
          demoMode={demoMode}
          mapFocusSignal={mapFocusSignal}
          onAllowLocation={liveLocation.requestLocation}
          onRetryLocation={liveLocation.retry}
          onManualPickup={() => setModal("pickup")}
          onBrand={demoMode ? () => setModal("demo") : undefined}
          onCall={callPartner}
          onMessage={() => setModal("messages")}
          onRequest={() => { setSelectedKind("chocolate"); setModal("pitstop"); }}
          onCoffee={() => { setSelectedKind("coffee"); setModal("pitstop"); }}
          onAddStop={() => { setSelectedKind("stop"); setModal("pitstop"); }}
          onDestination={() => { setPendingDestination(state.destination); setModal("destination"); }}
          onComeGetMe={startRequest}
          onFindPartner={() => {
            setMapFocusSignal((value) => value + 1);
            notify("Showing both of you on the map");
          }}
          onStage={setStage}
          onCancel={() => setModal("cancel")}
          onReady={() => { if (!requireAccount()) return; patchState({ riderReady: true }); notify("Sasi knows you’re coming downstairs"); }}
          onSharing={() => patchState({ sharing: !state.sharing })}
          onDriverOnline={() => patchState({ driverOnline: !state.driverOnline, sharing: false })}
          onPitStopStatus={(id, status) => { if (!requireAccount()) return; setState((current) => ({
            ...current,
            pitStops: current.pitStops.map((item) => item.id === id ? { ...item, status } : item),
            lastUpdated: Date.now(),
          })); }}
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
          profileName={profileName}
          profileAvatar={profileAvatar}
          onConnect={() => setAccountGate(accountSession.authenticated ? "pair" : "signin")}
          permission={permission}
          installPrompt={installPrompt}
          onInstall={async () => {
            if (installPrompt) await installPrompt.prompt();
            else notify("On iPhone, use Share → Add to Home Screen");
          }}
          onPatch={patchState}
        />
      )}

      {accountGate && <AccountGate session={accountSession} pairing={accountGate === "pair"} onClose={() => setAccountGate(null)} />}
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
                pickup={state.pickup}
                destination={pendingDestination}
                pitStops={state.pitStops}
                onDestination={() => setModal("destination")}
                onSubmit={submitRide}
              />
            )}

            {modal === "pickup" && (
              <PickupModal
                value={state.pickup === "Choose your pickup location" ? "" : state.pickup}
                onUseLocation={() => {
                  setModal("none");
                  liveLocation.requestLocation();
                }}
                onSelect={(value) => {
                  patchState({ pickup: value });
                  setModal("none");
                  notify("Pickup location updated");
                }}
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
                partnerName={state.role === "rider" ? "Sasi" : "Monu"}
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

            {modal === "demo" && demoMode && (
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

export default function AlongPage() {
  return <IntroExperience>{(backToIntro) => <AlongApp skipWelcome onBackToIntro={backToIntro} />}</IntroExperience>;
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

function SasiAvatar({ className = "" }: { className?: string }) {
  return (
    <span className={`person-avatar sasi-avatar ${className}`.trim()} aria-label="Sasi">
      <span aria-hidden="true">S</span>
      <img
        src={SASI_PROFILE_PHOTO}
        alt="Sasi"
        onError={(event) => { event.currentTarget.hidden = true; }}
      />
    </span>
  );
}

function PlaceCard({ className, icon, label, detail }: { className: string; icon: React.ReactNode; label: string; detail: string }) {
  return <article className={`place-card ${className}`}><span>{icon}</span><div><strong>{label}</strong><p>{detail}</p></div></article>;
}

function Onboarding({ onComplete, initialStep = 0, onBackToIntro }: { onComplete: (name: string, role: Role) => void; initialStep?: number; onBackToIntro?: () => void }) {
  const [step, setStep] = useState(initialStep);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const partner = role === "driver" ? "your pillion" : "the person who picks you up";

  return (
    <main className="app-shell onboarding-shell">
      <div className="onboarding-progress" aria-label={`Step ${step + 1} of 5`}><i style={{ width: `${((step + 1) / 5) * 100}%` }} /></div>
      {step === 0 && <section className="onboarding-page welcome-page"><div className="onboarding-brand"><span>A</span>along</div><div className="connection-visual"><div className="onboard-avatar monu">M</div><svg viewBox="0 0 180 74" aria-hidden="true"><path d="M26 45 C62 4 112 72 154 27" /><circle cx="89" cy="37" r="4" /></svg><SasiAvatar className="onboard-avatar" /></div><div className="onboarding-copy"><span>Made for two</span><h1>Know when your person is actually on the way.</h1><p>Live journey awareness for two people.</p></div><button className="onboarding-cta" onClick={() => setStep(1)}>Get started <ArrowRight size={20} /></button></section>}

      {step === 1 && <section className="onboarding-page"><button className="onboarding-back" onClick={() => onBackToIntro ? onBackToIntro() : setStep(0)} aria-label="Back">←</button><div className="onboarding-copy"><span>First, you</span><h1>What should we call you?</h1><p>This is how your person will see you in Along.</p></div><label className="name-field"><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" maxLength={24} /></label><button className="onboarding-cta" disabled={!name.trim()} onClick={() => setStep(2)}>Continue <ArrowRight size={20} /></button></section>}

      {step === 2 && <section className="onboarding-page"><button className="onboarding-back" onClick={() => setStep(1)} aria-label="Back">←</button><div className="onboarding-copy"><span>Your usual role</span><h1>How do you usually travel together?</h1><p>You can change this later from your profile.</p></div><div className="role-cards"><button className={role === "driver" ? "selected" : ""} onClick={() => setRole("driver")}><i><Bike size={28} /></i><span><strong>Rider</strong><b>I’m usually the one riding</b><small>I travel to pick up my person.</small></span>{role === "driver" && <CheckCircle2 size={22} />}</button><button className={role === "rider" ? "selected" : ""} onClick={() => setRole("rider")}><i><MapPin size={28} /></i><span><strong>Pillion</strong><b>I’m usually the one waiting</b><small>I track my person and request pickup.</small></span>{role === "rider" && <CheckCircle2 size={22} />}</button></div><button className="onboarding-cta" disabled={!role} onClick={() => setStep(3)}>Continue <ArrowRight size={20} /></button></section>}

      {step === 3 && <section className="onboarding-page pairing-page"><button className="onboarding-back" onClick={() => setStep(2)} aria-label="Back">←</button><div className="onboarding-copy"><span>Just the two of you</span><h1>{role === "driver" ? "Who rides pillion with you?" : "Who usually picks you up?"}</h1><p>Along stays private. Only you and your person can join this space.</p></div><div className="pairing-card"><div className="pairing-avatars"><div className="onboard-avatar monu">{name.trim().charAt(0).toUpperCase()}</div><span><Heart size={18} /></span><div className="onboard-avatar empty"><UserRound size={24} /></div></div><strong>Invite {partner}</strong><small>Share a one-time private connection link.</small></div><button className="onboarding-cta" onClick={() => setStep(4)}>Invite your person <Send size={19} /></button></section>}

      {step === 4 && <section className="onboarding-page connected-page"><div className="connected-avatars"><div className="onboard-avatar monu">{name.trim().charAt(0).toUpperCase()}</div><span><Heart size={18} fill="currentColor" /></span><SasiAvatar className="onboard-avatar" /></div><div className="success-ring"><Check size={25} /></div><div className="onboarding-copy"><span>Private connection ready</span><h1>You’re connected</h1><p>Now you’ll both know when the other is actually on the way.</p></div><button className="onboarding-cta" onClick={() => onComplete(name.trim(), role || "rider")}>Open Along <ArrowRight size={20} /></button></section>}
    </main>
  );
}

type RideProps = {
  state: AppState;
  role: Role;
  driverTitle: string;
  age: string;
  visibleSpeed: number | null;
  reading: SpeedReading;
  permission: "prompt" | "granted" | "denied" | "unavailable";
  deviceLocation?: DeviceLocation;
  locationStatus: "idle" | "finding" | "ready" | "error" | "paused";
  demoMode: boolean;
  mapFocusSignal: number;
  onAllowLocation: () => void;
  onRetryLocation: () => void;
  onManualPickup: () => void;
  onBrand?: () => void;
  onCall: () => void;
  onMessage: () => void;
  onRequest: () => void;
  onCoffee: () => void;
  onAddStop: () => void;
  onDestination: () => void;
  onComeGetMe: () => void;
  onFindPartner: () => void;
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
      <LiveMap
        key={role}
        state={state}
        role={role}
        deviceLocation={props.deviceLocation}
        permission={props.permission}
        locationStatus={props.locationStatus}
        demoMode={props.demoMode}
        focusSignal={props.mapFocusSignal}
        visibleSpeed={props.visibleSpeed}
        onBrand={props.onBrand}
        onAllowLocation={props.onAllowLocation}
        onRetryLocation={props.onRetryLocation}
        onManualPickup={props.onManualPickup}
      />
      <section className="ride-sheet">
        <div className="sheet-handle" />
        {role === "rider" ? <RiderRidePanel {...props} /> : <DriverRidePanel {...props} />}
      </section>
    </section>
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
        <SasiAvatar className="ride-partner-avatar" />
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
            <button onClick={props.onRequest}><span><Gift /></span>Treat</button>
            <button onClick={props.onCoffee}><span><Coffee /></span>Coffee</button>
            <button onClick={props.onAddStop}><span><MapPin /></span>Add stop</button>
            <button onClick={props.onMessage}><span><MessageCircle /></span>Message</button>
          </div>
          <button className="come-button" onClick={props.onComeGetMe} disabled={!state.driverOnline}><span>{state.driverOnline ? "Come get me" : "Sasi is offline"}<small>{state.driverOnline ? "Pickup from your current location" : "We’ll let you know when he’s back"}</small></span><i><ArrowRight size={20} /></i></button>
          <button className="destination-link" onClick={props.onDestination}><MapPin size={14} />{state.destination || "Add a destination now or decide together"}<ChevronRight size={15} /></button>
        </>
      )}

      {inMotion && (
        <div className="live-ride-content">
          {["accepted", "enroute", "nearby"].includes(state.stage) && <div className="journey-eta"><strong>{state.stage === "nearby" ? "2" : "12"}<small> min</small></strong><span>{state.stage === "nearby" ? "Almost with you" : "4.2 km away"}</span></div>}
          <RideTimeline stage={state.stage} />
          {state.destination && <div className="route-summary"><div><i /><span><small>Pickup</small>{state.pickup}</span></div><div><b /><span><small>Destination</small>{state.destination}</span></div></div>}
          {state.pitStops.length > 0 && (
            <div className="active-requests">
              {state.pitStops.map((item) => <div key={item.id}><span>{item.emoji}</span><p><strong>{item.status === "secured" ? `${item.title} secured` : item.title}</strong>{item.detail}</p><em className={`request-status ${item.status}`}>{requestStatusCopy[item.status]}</em></div>)}
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
      <ContentHeader kicker="REQUESTS" title="What should they bring?" subtitle="Add it before pickup or while they’re on the way." />
      <div className="request-grid">{requestKinds.map((item) => <button key={item.kind} onClick={() => onAdd(item.kind)}><span>{item.emoji}</span><strong>{item.title}</strong><small>{item.detail}</small><i><Plus size={16} /></i></button>)}</div>
      <div className="section-heading"><div><span>This ride</span><h2>Your requests</h2></div><em>{requests.length}</em></div>
      {requests.length ? <div className="request-list">{requests.map((item) => <div key={item.id}><span>{item.emoji}</span><p><strong>{item.status === "secured" ? `${item.title} secured` : item.title}</strong>{item.detail}</p><em className={`request-status ${item.status}`}>{requestStatusCopy[item.status]}</em><button onClick={() => onRemove(item.id)} aria-label={`Remove ${item.title}`}><X size={16} /></button></div>)}</div> : <div className="empty-card"><Sparkles size={22} /><strong>Nothing extra yet</strong><span>Little requests for the next ride will appear here.</span></div>}
      <div className="request-note"><Info size={16} /><span>He can mark an item secured or unavailable. You’ll always see the update.</span></div>
    </section>
  );
}

function UsScreen() {
  return (
    <section className="screen content-screen us-screen">
      <ContentHeader kicker="US" title="184 km together" subtitle="The routes, treats, and little detours that belong to just you two." />
      <div className="us-hero">
        <div className="memory-map"><div className="memory-road a" /><div className="memory-road b" /><div className="memory-road c" /><span className="memory-pin one"><HomeIcon size={15} /></span><span className="memory-pin two"><Coffee size={15} /></span><span className="memory-pin three"><Heart size={14} /></span><div className="memory-route" /><div className="hero-pair"><span>M</span><SasiAvatar /></div></div>
        <div className="us-stats"><span><strong>24</strong>rides</span><span><strong>11</strong>coffee stops</span><span><strong>8</strong>chocolate missions</span><span><strong>6</strong>late-night pickups</span></div>
      </div>
      <div className="section-heading"><div><span>Saved together</span><h2>Our places</h2></div></div>
      <div className="favorite-places"><PlaceCard className="home" icon={<HomeIcon />} label="Home" detail="18 arrivals together" /><PlaceCard className="cafe" icon={<Coffee />} label="Favourite café" detail="7 stops together" /><PlaceCard className="office" icon={<Store />} label="Her office" detail="12 pickups together" /><PlaceCard className="beach" icon={<Navigation2 />} label="Beach road" detail="3 sunset rides" /></div>
      <div className="section-heading"><div><span>Recent</span><h2>Journeys</h2></div><button>See all</button></div>
      <article className="memory-card"><div className="memory-art"><span>SAT<br/>8:42</span><i>☂</i></div><div><strong>Sasi → Monu → Writer’s Café</strong><p>11.2 km · 34 min</p><div className="memory-chips"><span>🍫 Chocolate secured</span></div></div></article>
      <article className="memory-card"><div className="memory-art warm"><span>THU<br/>6:15</span><i>☕</i></div><div><strong>Office → Blue Tokai → Home</strong><p>8.6 km · 29 min</p><div className="memory-chips"><span>☕ Coffee stop</span></div></div></article>
    </section>
  );
}

type ProfileProps = { state: AppState; profileName: string; profileAvatar: string | null; onConnect: () => void; permission: string; installPrompt: InstallPrompt | null; onInstall: () => void; onPatch: (patch: Partial<AppState>) => void };
function ProfileScreen({ state, profileName, profileAvatar, onConnect, permission, installPrompt, onInstall, onPatch }: ProfileProps) {
  const [notifications, setNotifications] = useState(true);
  const isPillion = state.role === "rider";
  return (
    <section className="screen content-screen profile-screen">
      <ContentHeader kicker="PROFILE" title={profileName} subtitle={`${isPillion ? "Pillion" : "Rider"} · private by design`} />
      <div className="profile-identity"><div className={`profile-avatar ${isPillion ? "monu" : "sasi"}`}>{profileAvatar ? <img className="setup-profile-avatar" src={profileAvatar} alt="Your avatar" /> : <UserRound />}</div><div><strong>{profileName}</strong><span>{isPillion ? "Usually waiting" : "Usually riding"}</span></div></div>
      <div className="section-heading"><div><span>Connected</span><h2>Your person</h2></div></div>
      <div className="partner-card"><div className="partner-avatars"><span className="monu-avatar">M</span><i><Heart size={10} fill="currentColor" /></i><SasiAvatar className="partner-photo" /></div><div><small>YOUR PERSON</small><strong>{isPillion ? "Sasi" : "Monu"}</strong><p>{isPillion ? "Rider · White Ather 450X" : "Pillion · Connected"}</p></div><button aria-label={`Call ${isPillion ? "Sasi" : "Monu"}`}><Phone size={18} /></button></div>
      <div className="partner-actions"><button>View profile</button><button onClick={onConnect}>Connect your partner</button></div>
      <div className="settings-group"><h3>Places & rides</h3><SettingsRow Icon={MapPin} title="Saved places" detail="Home, Work, 3 more" /><SettingsRow Icon={Route} title="Ride history" detail="24 rides together" /><SettingsRow Icon={Users} title="Emergency contacts" detail="2 people" /></div>
      <div className="settings-group"><h3>Privacy & safety</h3><SettingsRow Icon={Radio} title="Live location" detail={state.sharing ? "Shared during active rides" : "Sharing is paused"} control={<Toggle on={state.sharing} onClick={() => onPatch({ sharing: !state.sharing })} />} /><SettingsRow Icon={Crosshair} title="Location permission" detail={permission === "granted" ? "Precise location allowed" : permission === "denied" ? "Permission denied" : "Ask when needed"} /><SettingsRow Icon={ShieldCheck} title="Privacy promise" detail="Never tracked silently or 24/7" /></div>
      <div className="settings-group"><h3>App</h3><SettingsRow Icon={BellRing} title="Notifications" detail="Ride and request updates" control={<Toggle on={notifications} onClick={() => setNotifications(!notifications)} />} /><SettingsRow Icon={Moon} title="Appearance" detail={state.appearance === "light" ? "Soft light" : "Night ride"} control={<Toggle on={state.appearance === "dark"} onClick={() => onPatch({ appearance: state.appearance === "light" ? "dark" : "light" })} />} /><button className="setting-row" onClick={onInstall}><span className="setting-icon"><Navigation size={18} /></span><span><strong>{installPrompt ? "Install Along" : "Add to Home Screen"}</strong><small>Faster launch, full-screen feel</small></span><ChevronRight size={17} /></button><SettingsRow Icon={Info} title="About Along" detail="Made for two · v1.0" /></div>
      <div className="web-limit-note"><BatteryLow size={18} /><p><strong>A note about background tracking</strong>Mobile web browsers—especially iPhone when locked—can pause location updates. For the freshest location, keep Along open during an active ride.</p></div>
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

function BookingModal({ pickup, destination, pitStops, onDestination, onSubmit }: { pickup: string; destination: string; pitStops: PitStop[]; onDestination: () => void; onSubmit: () => void }) {
  return <div className="booking-modal"><span className="modal-kicker">YOUR RIDE</span><h2>Come get me</h2><p>Sasi will receive your current pickup and anything you need on the way.</p><div className="booking-route"><div><i /><span><small>PICKUP NOW</small>{pickup}</span></div><button onClick={onDestination}><b /><span><small>DESTINATION · OPTIONAL</small>{destination || "Where are you going?"}</span><ChevronRight size={17} /></button></div>{pitStops.length > 0 && <div className="booking-requests"><span>{pitStops.map((item) => item.emoji).join(" ")}</span><p><strong>{pitStops.length} request{pitStops.length > 1 ? "s" : ""} attached</strong>Sasi can confirm each one</p></div>}<div className="privacy-inline"><ShieldCheck size={17} /><span>Live sharing starts after Sasi accepts.</span></div><button className="primary-button" onClick={onSubmit}>Send to Sasi <ArrowRight size={18} /></button><small className="modal-footnote">No destination needed. You can decide together later.</small></div>;
}

function PickupModal({ value, onUseLocation, onSelect }: { value: string; onUseLocation: () => void; onSelect: (value: string) => void }) {
  const [pickup, setPickup] = useState(value);
  return <div className="destination-modal"><span className="modal-kicker">PICKUP</span><h2>Where should Sasi meet you?</h2><div className="search-box"><MapPin size={19} /><input value={pickup} onChange={(event) => setPickup(event.target.value)} placeholder="Search or enter an address" aria-label="Pickup address" /><button onClick={() => pickup && onSelect(pickup)} disabled={!pickup} aria-label="Use this pickup"><ArrowRight size={17} /></button></div><button className="current-location" onClick={onUseLocation}><Crosshair size={18} /><span><strong>Use my live location</strong>Ask the browser for your precise position</span><ChevronRight size={17} /></button><h3>Saved places</h3><div className="places-list">{places.map(({ title, address, icon: Icon }) => <button key={title} onClick={() => onSelect(`${title} · ${address}`)}><span><Icon size={18} /></span><p><strong>{title}</strong>{address}</p><ChevronRight size={16} /></button>)}</div></div>;
}

function DestinationModal({ value, onChange, onSelect }: { value: string; onChange: (value: string) => void; onSelect: (value: string) => void }) {
  return <div className="destination-modal"><span className="modal-kicker">DESTINATION</span><h2>Where to?</h2><div className="search-box"><MapPin size={19} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search a place or address" aria-label="Search a place or address" /><button onClick={() => value && onSelect(value)} aria-label="Use this destination"><ArrowRight size={17} /></button></div><button className="current-location" onClick={() => onSelect("")}><Crosshair size={18} /><span><strong>Choose on the way</strong>Keep destination open for now</span><ChevronRight size={17} /></button><h3>Saved places</h3><div className="places-list">{places.map(({ title, address, icon: Icon }) => <button key={title} onClick={() => onSelect(`${title} · ${address}`)}><span><Icon size={18} /></span><p><strong>{title}</strong>{address}</p><ChevronRight size={16} /></button>)}</div></div>;
}

function MessagesModal({ onSend }: { onSend: (message: string) => void }) {
  const [message, setMessage] = useState("");
  return <div className="messages-modal"><span className="modal-kicker">QUICK MESSAGE</span><h2>Tell Sasi</h2><div className="message-grid">{quickMessages.map((item) => <button key={item} onClick={() => onSend(item)}>{item}</button>)}</div><div className="message-input"><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write something…" /><button disabled={!message} onClick={() => onSend(message)}><Send size={17} /></button></div></div>;
}

function PitStopModal({ kind, partnerName, chocolate, custom, onKind, onChocolate, onCustom, onAdd, duringRide }: { kind: PitStop["kind"]; partnerName: string; chocolate: string; custom: string; onKind: (kind: PitStop["kind"]) => void; onChocolate: (value: string) => void; onCustom: (value: string) => void; onAdd: () => void; duringRide: boolean }) {
  const template = requestKinds.find((item) => item.kind === kind)!;
  const needsChoice = kind === "chocolate" && !chocolate;
  return <div className="pitstop-modal"><span className="modal-kicker">{duringRide ? "Add to this ride" : "Ask ahead"}</span><h2>{template.title}?</h2><p>{template.detail}. Keep it simple and they can answer safely.</p><div className="kind-scroll">{requestKinds.map((item) => <button key={item.kind} className={kind === item.kind ? "active" : ""} onClick={() => onKind(item.kind)}><span>{item.emoji}</span>{item.title}</button>)}</div><div className="request-detail-hero"><span>{template.emoji}</span><div><small>Asking {partnerName}</small><strong>{template.title}</strong><p>{template.detail}</p></div></div>{kind === "chocolate" && <div className="choice-chips"><span className="choice-label">Choose one</span>{["Dairy Milk Silk", "KitKat", "Ferrero Rocher", "Surprise me"].map((item) => <button key={item} className={chocolate === item ? "active" : ""} onClick={() => onChocolate(item)}>{chocolate === item && <Check size={14} />}{item}</button>)}</div>}{kind === "coffee" && <div className="choice-chips"><span className="choice-label">When?</span>{["Before pickup", "During our ride", "Your call"].map((item) => <button key={item}>{item}</button>)}</div>}{kind === "custom" && <textarea value={custom} onChange={(event) => onCustom(event.target.value)} placeholder="What should they bring or do?" aria-label="Custom request" maxLength={100} />}<label className="route-stop-option"><input type="checkbox" defaultChecked={kind !== "custom"} /><span><strong>Add it as a stop on the way</strong>{partnerName} can adjust if it’s out of the way.</span></label><button className="primary-button" onClick={onAdd} disabled={needsChoice}>Ask {partnerName} <ArrowRight size={18} /></button></div>;
}

function CancelModal({ stage, onKeep, onCancel }: { stage: RideStage; onKeep: () => void; onCancel: () => void }) {
  const enroute = ["accepted", "enroute", "nearby", "arrived"].includes(stage);
  return <div className="cancel-modal"><div className="cancel-icon"><AlertTriangle size={24} /></div><h2>Cancel this ride?</h2><p>{enroute ? "Sasi is already on the way. He’ll be told immediately and location sharing will stop." : "Your request will close and won’t be sent again."}</p><button className="primary-button" onClick={onKeep}>Keep my ride</button><button className="text-button danger" onClick={onCancel}>Yes, cancel ride</button></div>;
}

function DemoModal({ state, onRole, onStage, onEdge, onReset, hint, onHint }: { state: AppState; onRole: (role: Role) => void; onStage: (stage: RideStage) => void; onEdge: (edge: EdgeMode) => void; onReset: () => void; hint: boolean; onHint: () => void }) {
  const stages: RideStage[] = ["idle", "requested", "enroute", "nearby", "arrived", "active", "paused", "complete"];
  const edgeModes: EdgeMode[] = ["normal", "offline", "weak", "stale", "gps-low", "gps-denied", "map-failed", "backgrounded"];
  return <div className="demo-modal"><span className="modal-kicker">Private preview tool</span><h2>Demo controls</h2><p>Switch sides and jump between realistic journey and connection states. This panel stays hidden behind the Along wordmark.</p><div className="demo-label">View as</div><div className="segmented"><button className={state.role === "rider" ? "active" : ""} onClick={() => onRole("rider")}><CircleUserRound size={17} />Monu · Pillion</button><button className={state.role === "driver" ? "active" : ""} onClick={() => onRole("driver")}><Bike size={17} />Sasi · Rider</button></div><div className="demo-label">Journey moment</div><div className="demo-chips">{stages.map((stage) => <button key={stage} className={state.stage === stage ? "active" : ""} onClick={() => onStage(stage)}>{stageLabel[stage]}</button>)}</div><div className="demo-label">Edge state</div><div className="demo-chips edge-chips">{edgeModes.map((mode) => <button key={mode} className={state.edgeMode === mode ? "active" : ""} onClick={() => onEdge(mode)}>{mode.replace("gps-", "GPS ").replace("map-", "map ")}</button>)}</div>{!hint ? <button className="demo-tip" onClick={onHint}><Info size={15} />Why these controls?</button> : <div className="demo-explanation">They make every important edge case visible without waiting for a real GPS drop, network failure, or second phone.</div>}<button className="reset-button" onClick={onReset}><RotateCcw size={17} />Reset demo data</button></div>;
}
