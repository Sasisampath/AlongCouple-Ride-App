"use client";
/* eslint-disable @next/next/no-img-element -- optimized, bundled Along artwork. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, Bell, CaretRight, Check, Heart, Info, LinkBreak, LockKey, MapPinLine, PencilSimple, Scooter, ShieldCheck, SignIn, SignOut, UserCircle, UserPlus, X } from "@phosphor-icons/react";
import { version } from "../../package.json";
import { imageGroups, optimizedImage, preloadImages } from "../lib/image-loading";
import { locationPermissionLabel, notificationPermissionLabel, profileAssets, profileAvatars, roleLabel, type ProfileAccount, type ProfilePartner, type ProfilePatch } from "../lib/profile";
import type { Role } from "../lib/types";
import "./profile-experience.css";

type Sheet = "name" | "avatar" | "role" | "location" | "permissions" | "notifications" | "privacy" | "visibility" | "account" | "connection" | "unpair" | "about" | null;
type Props = {
  name: string; avatar: string | null; role: Role; account: ProfileAccount; demoMode: boolean;
  sharing: boolean; permission: string; activeJourney: boolean; partner?: ProfilePartner;
  onSave: (patch: ProfilePatch) => void | Promise<void>; onConnect: () => void;
  onAllowLocation: () => void; onStopSharing: () => void;
};
function notificationState() { return typeof Notification === "undefined" ? "unsupported" : Notification.permission; }

export function ProfileExperience({ name, avatar, role, account, demoMode, sharing, permission, activeJourney, partner: suppliedPartner, onSave, onConnect, onAllowLocation, onStopSharing }: Props) {
  const tour = demoMode || !account.authenticated;
  const [removedPair, setRemovedPair] = useState<string | null>(null);
  const partner = !tour && suppliedPartner?.id !== removedPair ? suppliedPartner : undefined;
  const [sheet, setSheet] = useState<Sheet>(null);
  const [draftName, setDraftName] = useState(name);
  const [draftAvatar, setDraftAvatar] = useState(avatar);
  const [draftRole, setDraftRole] = useState(role);
  const [notification, setNotification] = useState(notificationState);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void preloadImages([...imageGroups.profile, ...imageGroups.setup]);
    const refresh = () => setNotification(notificationState());
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", refresh);
    return () => { mounted.current = false; window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const open = (next: Sheet) => {
    setError(""); setFeedback("");
    if (next === "name") setDraftName(name);
    if (next === "avatar") setDraftAvatar(avatar);
    if (next === "role") setDraftRole(role);
    setSheet(next);
  };
  const connect = () => { setSheet(null); onConnect(); };
  const perform = async (action: () => void | Promise<void>, message: string, close = true) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    try { await action(); if (mounted.current) { setFeedback(message); if (close) setSheet(null); } }
    catch { if (mounted.current) setError("Couldn’t save that. Please try again. Your selection is still here."); }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  };
  const requestNotifications = async () => {
    if (notification !== "default" || busy.current) return;
    await perform(async () => { setNotification(await Notification.requestPermission()); }, "", false);
  };
  const status = Boolean(partner && sharing && permission === "granted");
  const titles: Record<Exclude<Sheet, null>, string> = {
    name: "Your profile", avatar: "Pick your Along", role: "Your usual role", location: "Location sharing",
    permissions: "Privacy & permissions", notifications: "Notifications", privacy: "Privacy", visibility: "Partner visibility",
    account: "Account", connection: "Your connection", unpair: "Unpair from your person?", about: "About Along",
  };
  const saveEdit = () => {
    if (sheet === "role" && activeJourney) return;
    const patch = sheet === "name" ? { name: draftName.trim() } : sheet === "avatar" && draftAvatar ? { avatar: draftAvatar } : sheet === "role" ? { role: draftRole } : null;
    if (patch) void perform(() => onSave(patch), "Profile saved on this device");
  };

  return <section className="along-profile" aria-label="You">
    <header className="along-profile-header"><h1>You</h1>{tour && <span className="along-home-status"><i />Tour mode</span>}</header>
    <div className="along-profile-identity">
      <ProfileAvatar src={avatar} label="Your selected avatar" />
      <div><h2>{name.trim() || "Your profile"}</h2><span>{roleLabel(role)}</span></div>
      <button className="along-profile-icon" aria-label="Edit profile" onClick={() => open("name")}><PencilSimple size={21} /></button>
    </div>
    <div className="along-profile-personal-actions"><button onClick={() => open("avatar")}><UserCircle size={17} />Change avatar</button><button onClick={() => open("role")}><Scooter size={18} />Change role</button></div>

    <section className="along-profile-section" aria-labelledby="profile-along"><h2 id="profile-along">Your Along</h2>
      <article className="along-profile-partner-card">
        {partner ? <><div className="along-profile-partner"><ProfileAvatar src={partner.avatar} label="Your person’s selected avatar" /><div><h3>{partner.name?.trim() || "Your person"}</h3><span>Connected ❤️</span></div><img src={profileAssets.connection} alt="" width={48} height={48} /></div><button className="along-profile-link" onClick={() => open("connection")}>View connection<ArrowRight size={18} /></button></>
          : <><div className="along-profile-invite"><img src={profileAssets.connection} alt="" width={92} height={90} /><h3>Bring your<br />person Along</h3></div><button className="along-profile-primary" onClick={connect}><UserPlus size={19} />Invite your person</button></>}
      </article>
    </section>

    <button className="along-profile-location" onClick={() => open("location")}><img src={profileAssets.location} alt="" width={62} height={66} /><span><strong>Location sharing</strong><small><i className={status ? "is-on" : ""} />{status ? "On" : "Off"}</small></span><CaretRight size={19} /></button>

    <section className="along-profile-settings" aria-labelledby="profile-privacy"><div className="along-profile-card-heading"><img src={profileAssets.privacy} alt="" width={58} height={60} /><h2 id="profile-privacy">Privacy &<br />permissions</h2></div>
      <ProfileRow Icon={MapPinLine} title="Location permission" detail={locationPermissionLabel(permission)} onClick={() => open("permissions")} />
      <ProfileRow Icon={Bell} title="Notifications" detail={notificationPermissionLabel(notification)} onClick={() => open("notifications")} />
      <ProfileRow Icon={ShieldCheck} title="Privacy" onClick={() => open("privacy")} />
    </section>

    <section className="along-profile-settings" aria-labelledby="profile-account"><div className="along-profile-card-heading"><img src={profileAssets.account} alt="" width={58} height={60} /><div><h2 id="profile-account">Account</h2>{account.authenticated && <p>{account.email || account.name || "Signed in"}</p>}</div></div>
      {account.authenticated ? <ProfileRow Icon={SignOut} title="Sign out" onClick={() => open("account")} /> : <ProfileRow Icon={SignIn} title="Sign in" onClick={connect} />}
    </section>
    <button className="along-profile-about" onClick={() => open("about")}><Info size={17} /><span>About Along</span><small>Version {version}</small><CaretRight size={16} /></button>
    {feedback && <p className="along-profile-feedback" role="status"><Check size={17} />{feedback}</p>}

    {sheet && <ProfileSheet title={titles[sheet]} pending={pending} onClose={() => { if (!pending) setSheet(null); }}>
      {sheet === "name" || sheet === "avatar" || sheet === "role" ? <form onSubmit={event => { event.preventDefault(); saveEdit(); }}>
        <div className="along-profile-sheet-body">
          {sheet === "name" ? <><label className="along-profile-field" htmlFor="profile-name">Your name <span>Optional</span></label><input id="profile-name" value={draftName} onChange={event => setDraftName(event.target.value)} maxLength={40} autoComplete="nickname" placeholder="What should we call you?" disabled={pending} /><p className="along-profile-sheet-note">Saved on this device.</p></>
            : sheet === "avatar" ? <div className="along-profile-avatar-grid" role="group" aria-label="Choose your avatar">{profileAvatars.map((src, index) => <button type="button" key={src} disabled={pending} aria-label={`Avatar ${index + 1}`} aria-pressed={draftAvatar === src} onClick={() => setDraftAvatar(src)}><img src={src} alt="" width={512} height={512} decoding="async" />{draftAvatar === src && <i><Check size={14} /></i>}</button>)}</div>
              : <><div className="along-profile-role-options" role="group" aria-label="Your usual role">{(["driver", "rider"] as const).map(value => <button type="button" key={value} aria-pressed={draftRole === value} disabled={pending || activeJourney} onClick={() => setDraftRole(value)}>{value === "driver" ? <Scooter size={26} /> : <UserCircle size={26} />}<strong>{roleLabel(value)}</strong>{draftRole === value && <Check size={18} />}</button>)}</div>{activeJourney && <p className="along-profile-sheet-note">Finish your current journey before changing roles.</p>}</>}
          {error && <p className="along-profile-feedback" role="alert">{error}</p>}
        </div><footer><button className="along-profile-primary" type="submit" disabled={pending || (sheet === "avatar" && !draftAvatar) || (sheet === "role" && activeJourney)}>{pending ? "Saving…" : "Save changes"}<ArrowRight size={19} /></button><button className="along-profile-text" type="button" onClick={() => setSheet(null)} disabled={pending}>Not now</button></footer>
      </form> : <div className="along-profile-sheet-body">
        {sheet === "location" && <><div className="along-profile-detail-status"><MapPinLine size={26} /><strong>{status ? "On" : "Off"}</strong></div><p>{status ? "Location shared during your active ride." : "Your location isn’t being shared with your person."}</p><ProfileRow Icon={MapPinLine} title="Location permission" detail={locationPermissionLabel(permission)} onClick={() => open("permissions")} />
          {status ? <button className="along-profile-primary" onClick={() => { onStopSharing(); setFeedback("Location sharing is off"); setSheet(null); }}>Stop sharing</button> : !partner ? <button className="along-profile-primary" onClick={connect}>Connect to share<ArrowRight size={19} /></button> : <p>Start a ride from Home when you’re ready to share.</p>}
          <p className="along-profile-sheet-note">Mobile web browsers—especially iPhone when locked—can pause location updates. For the freshest location, keep Along open during an active ride.</p></>}
        {sheet === "permissions" && <><ProfileRow Icon={MapPinLine} title="Location permission" detail={locationPermissionLabel(permission)} />{permission === "prompt" || permission === "unavailable" ? <button className="along-profile-primary" onClick={onAllowLocation}>Allow location<ArrowRight size={19} /></button> : permission === "denied" ? <p>Location access is off. Enable it in your browser or app settings.</p> : <p>You can change location access in your browser or app settings.</p>}<ProfileRow Icon={Bell} title="Notifications" detail={notificationPermissionLabel(notification)} onClick={() => open("notifications")} /><ProfileRow Icon={LockKey} title="Partner location visibility" detail={partner?.locationVisible === true ? "Visible when shared" : partner ? "Not shared" : "Not connected"} onClick={() => open("visibility")} /></>}
        {sheet === "notifications" && <><div className="along-profile-detail-status"><Bell size={26} /><strong>{notificationPermissionLabel(notification)}</strong></div>{notification === "default" ? <><p>Choose whether Along can show notifications on this device.</p><button className="along-profile-primary" disabled={pending} onClick={() => void requestNotifications()}>{pending ? "Please wait…" : "Enable notifications"}<ArrowRight size={19} /></button></> : <p>{notification === "unsupported" ? "Notification permissions aren’t available in this browser. Check Along’s notification settings on your phone." : "You can change notifications in your browser or app settings."}</p>}<p className="along-profile-sheet-note">Permission alone doesn’t enable partner updates. Delivery isn’t available here yet.</p>{error && <p className="along-profile-feedback" role="alert">{error}</p>}</>}
        {sheet === "privacy" && <><div className="along-profile-detail-status"><ShieldCheck size={28} /><strong>Private by design</strong></div><p>Never tracked silently or 24/7.</p><ProfileRow Icon={MapPinLine} title="Location sharing" detail={status ? "On" : "Off"} onClick={() => open("location")} /><ProfileRow Icon={LockKey} title="Partner location visibility" onClick={() => open("visibility")} /></>}
        {sheet === "visibility" && <><div className="along-profile-detail-status"><LockKey size={28} /><strong>{partner?.locationVisible ? "Visible when shared" : "Not shared"}</strong></div><p>Your person’s location appears when they choose to share it.</p>{!partner && <button className="along-profile-primary" onClick={connect}>Invite your person<ArrowRight size={19} /></button>}</>}
        {sheet === "connection" && partner && <><div className="along-profile-connection-detail"><ProfileAvatar src={avatar} label="Your avatar" /><Heart size={22} weight="fill" /><ProfileAvatar src={partner.avatar} label="Your person’s avatar" /></div><h3>{partner.name?.trim() || "Your person"}</h3><p>Connected ❤️</p><button className="along-profile-text" onClick={() => open("unpair")}><LinkBreak size={18} />Unpair</button></>}
        {sheet === "unpair" && partner && <><p>You’ll need to connect again to share with each other.</p><button className="along-profile-primary" disabled={pending} onClick={() => open("connection")}>Keep connected</button><button className="along-profile-text" disabled={pending} onClick={() => void perform(async () => { await partner.unpair(); if (mounted.current) setRemovedPair(partner.id); }, "You’re no longer paired")}>{pending ? "Please wait…" : "Unpair"}<LinkBreak size={18} /></button>{error && <p className="along-profile-feedback" role="alert">{error}</p>}</>}
        {sheet === "account" && <><p>{account.email || account.name || (account.authenticated ? "Signed in" : "You’re not signed in")}</p>{account.authenticated && account.signOutUrl ? <a className="along-profile-account-link" href={account.signOutUrl}><SignOut size={20} />Sign out</a> : account.authenticated ? <p>Sign out isn’t available here yet.</p> : <button className="along-profile-primary" onClick={connect}>Sign in<ArrowRight size={19} /></button>}</>}
        {sheet === "about" && <><div className="along-profile-detail-status"><Info size={28} /><strong>Along</strong></div><p>Version {version}</p><p className="along-profile-sheet-note">A private ride and location companion for two.</p></>}
      </div>}
    </ProfileSheet>}
  </section>;
}

function ProfileAvatar({ src, label }: { src: string | null; label: string }) {
  return <span className="along-profile-avatar">{src ? <img src={optimizedImage(src)} alt={label} width={72} height={72} decoding="async" /> : <UserCircle size={54} weight="light" aria-label={label} />}</span>;
}
function ProfileRow({ Icon, title, detail, onClick }: { Icon: typeof Info; title: string; detail?: string; onClick?: () => void }) {
  const content = <><Icon size={20} /><span><strong>{title}</strong>{detail && <small>{detail}</small>}</span>{onClick && <CaretRight size={17} />}</>;
  return onClick ? <button className="along-profile-row" onClick={onClick}>{content}</button> : <div className="along-profile-row">{content}</div>;
}
function ProfileSheet({ title, pending, onClose, children }: { title: string; pending: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current; node?.showModal(); const viewport = window.visualViewport;
    const resize = () => { node?.style.setProperty("--profile-keyboard", `${viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0}px`); node?.style.setProperty("--profile-visible-height", `${viewport?.height || window.innerHeight}px`); };
    resize(); viewport?.addEventListener("resize", resize); viewport?.addEventListener("scroll", resize);
    return () => { node?.close(); viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); };
  }, []);
  return <dialog ref={dialog} className="along-profile-sheet" onCancel={event => { event.preventDefault(); if (!pending) onClose(); }} aria-labelledby="profile-sheet-title"><div className="along-profile-handle" aria-hidden="true" /><button className="along-profile-close" onClick={onClose} disabled={pending} aria-label="Close profile sheet"><X size={22} /></button><h2 id="profile-sheet-title">{title}</h2>{children}</dialog>;
}
