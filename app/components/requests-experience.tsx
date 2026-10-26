"use client";
/* eslint-disable @next/next/no-img-element -- approved PNG artwork is used unchanged. */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle, PencilSimple, X } from "@phosphor-icons/react";
import { advanceTourRequests, careOptions, isActiveRequest, isAlongRequest, readTourRequests, requestCategories, requestDate, requestStatusText, type AlongRequest, type CareOption, type PartnerRequestConnection, type RequestCategory, type RequestDraft } from "../lib/requests";
import "./requests-experience.css";

type Props = { authenticated: boolean; demoMode: boolean; onConnect: () => void; connection?: PartnerRequestConnection };
type Composer = { category: RequestCategory; editing?: AlongRequest };

export function RequestsExperience(props: Props) {
  return <RequestsPanel key={`${props.demoMode ? "demo" : props.authenticated ? props.connection?.pairId || "unpaired" : "tour"}`} {...props} />;
}

function RequestsPanel({ authenticated, demoMode, onConnect, connection }: Props) {
  const tour = !authenticated || demoMode;
  const storageKey = demoMode ? "along.requests.demo.v1" : "along.requests.tour.v1";
  const [items, setItems] = useState<AlongRequest[]>(() => tour ? readTourRequests(storageKey) : []);
  const [ready, setReady] = useState(tour || !connection);
  const [composer, setComposer] = useState<Composer | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const scope = useRef(0);
  const activeSection = useRef<HTMLElement>(null);
  const incomingSection = useRef<HTMLElement>(null);
  const reveal = useRef<"active" | "incoming" | null>(null);

  useEffect(() => {
    if (composer || !reveal.current) return;
    const section = reveal.current === "active" ? activeSection.current : incomingSection.current;
    section?.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    reveal.current = null;
  }, [composer, items]);

  useEffect(() => {
    const current = ++scope.current;
    if (!tour && connection) {
      let revision = 0;
      const unsubscribe = connection.subscribe(next => {
        revision++; if (scope.current === current) setItems(next.filter(isAlongRequest));
      });
      const initialRevision = revision;
      connection.load().then(next => {
        if (scope.current === current && revision === initialRevision) setItems(next.filter(isAlongRequest));
      }).catch(() => { if (scope.current === current) setError("Couldn’t load your requests. Check your connection and reopen Requests."); })
        .finally(() => { if (scope.current === current) setReady(true); });
      return () => { scope.current = current + 1; unsubscribe(); };
    }
    return () => { scope.current = current + 1; };
  }, [tour, storageKey, connection]);

  useEffect(() => {
    if (!tour || !ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify(items.slice(0, 50))); } catch { /* In-memory Tour remains available. */ }
  }, [items, ready, tour, storageKey]);

  useEffect(() => {
    if (!tour) return;
    const timer = setInterval(() => setItems(current => advanceTourRequests(current, Date.now())), 400);
    return () => clearInterval(timer);
  }, [tour]);

  const updateItem = (item: AlongRequest) => setItems(current => {
    const found = current.some(existing => existing.id === item.id);
    return found ? current.map(existing => existing.id === item.id ? item : existing) : [item, ...current];
  });
  const perform = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true; setPending(true); setError("");
    const current = scope.current;
    try { await action(); }
    catch { if (scope.current === current) setError("That didn’t go through. Check your connection and try again."); }
    finally { busy.current = false; if (scope.current === current) setPending(false); }
  };
  const submit = async (draft: RequestDraft) => {
    if (!tour && !connection) { setComposer(null); onConnect(); return; }
    await perform(async () => {
      const currentScope = scope.current;
      if (tour) {
        const now = Date.now();
        const editing = composer?.editing;
        if (editing) setItems(current => current.map(item => item.id === editing.id ? { ...item, ...draft, updatedAt: now } : item));
        else updateItem({ ...draft, id: crypto.randomUUID(), direction: "outgoing", status: "sending", createdAt: now, updatedAt: now });
      } else {
        const result = composer?.editing ? await connection!.edit(composer.editing.id, draft) : await connection!.send(draft);
        if (scope.current !== currentScope) return;
        updateItem(result);
      }
      reveal.current = "active";
      setComposer(null);
    });
  };
  const changeStatus = (item: AlongRequest, action: "cancel" | "acknowledge" | "complete" | "unavailable") => void perform(async () => {
    const allowed = action === "cancel" ? item.direction === "outgoing" && isActiveRequest(item)
      : item.direction === "incoming" && (action === "complete" ? item.status === "acknowledged" : item.status === "sent");
    if (!allowed) return;
    const currentScope = scope.current;
    const result = tour ? { ...item, status: ({ cancel: "cancelled", acknowledge: "acknowledged", complete: "completed", unavailable: "unavailable" } as const)[action], updatedAt: Date.now() }
      : await connection![action](item.id);
    if (scope.current === currentScope) updateItem(result);
  });

  const incoming = items.filter(item => item.direction === "incoming" && isActiveRequest(item));
  const active = items.filter(item => item.direction === "outgoing" && isActiveRequest(item));
  const recent = items.filter(item => !isActiveRequest(item)).sort((a, b) => b.updatedAt - a.updatedAt);
  const tryIncoming = () => {
    if (!tour || incoming.length) return;
    const now = Date.now();
    reveal.current = "incoming";
    updateItem({ id: crypto.randomUUID(), category: "coffee", note: "Cold coffee please", direction: "incoming", status: "sent", createdAt: now, updatedAt: now });
  };

  return <section className="along-requests" aria-label="Requests">
    <header className="along-requests-header"><div><h1>Requests</h1><p>What do you need?</p></div>
      {tour && <span className="along-home-status"><i />Tour mode</span>}
    </header>
    {incoming.length > 0 && <section ref={incomingSection} className="along-requests-incoming" aria-label="Incoming requests">
      {incoming.map(item => <RequestCard key={item.id} item={item} incoming tour={tour} pending={pending} onAcknowledge={() => changeStatus(item, "acknowledge")} onComplete={() => changeStatus(item, "complete")} onUnavailable={() => changeStatus(item, "unavailable")} />)}
    </section>}
    <div className="along-request-grid">{requestCategories.map(category => <button key={category.id} onClick={() => { setError(""); setComposer({ category: category.id }); }}>
      <img src={category.image} alt="" width={128} height={128} draggable={false} /><span>{category.label}</span>
    </button>)}</div>
    {!ready && <p className="along-requests-feedback" role="status">Loading your requests…</p>}
    {error && !composer && <p className="along-requests-feedback" role="alert">{error}</p>}
    {active.length > 0 && <section ref={activeSection} className="along-requests-section" aria-labelledby="active-requests"><h2 id="active-requests">Active</h2>
      <div className="along-requests-list" aria-live="polite">{active.map(item => <RequestCard key={item.id} item={item} tour={tour} pending={pending}
        onEdit={() => setComposer({ category: item.category, editing: item })} onCancel={() => changeStatus(item, "cancel")} />)}</div>
    </section>}
    {recent.length > 0 && <section className="along-requests-section" aria-labelledby="recent-requests"><h2 id="recent-requests">Recent</h2>
      <div className="along-requests-recent">{recent.slice(0, 10).map(item => {
        const category = requestCategories.find(category => category.id === item.category)!;
        return <div key={item.id}><img src={category.image} alt="" width={48} height={48} /><div><strong>{category.label}</strong><span>{requestStatusText[item.status]}</span></div><time dateTime={new Date(item.updatedAt).toISOString()}>{requestDate(item.updatedAt)}</time></div>;
      })}</div>
    </section>}
    {tour && items.some(item => item.status === "acknowledged" || item.status === "completed") && <aside className="along-requests-tour-end">
      <p>Want to send this for real?</p><button className="along-requests-primary" onClick={onConnect}>Sign in <ArrowRight size={20} /></button>
      {!incoming.length && <button className="along-requests-text" onClick={tryIncoming}>Try an incoming request</button>}
    </aside>}
    {composer && <RequestComposer key={composer.editing?.id || composer.category} category={composer.category} editing={composer.editing} tour={tour} pending={pending} error={error} onClose={() => { if (!pending) setComposer(null); }} onSubmit={submit} />}
  </section>;
}

function RequestCard({ item, incoming, tour, pending, onEdit, onCancel, onAcknowledge, onComplete, onUnavailable }: {
  item: AlongRequest; incoming?: boolean; tour: boolean; pending: boolean; onEdit?: () => void; onCancel?: () => void;
  onAcknowledge?: () => void; onComplete?: () => void; onUnavailable?: () => void;
}) {
  const category = requestCategories.find(category => category.id === item.category)!;
  const want = item.category === "custom" ? "something" : item.category === "grocery" ? "groceries" : item.category === "care" ? (item.care || "care").toLowerCase() : category.label.toLowerCase();
  return <article className={`along-request-card${incoming ? " is-incoming" : ""}`}>
    <div className="along-request-summary"><img src={category.image} alt="" width={68} height={68} /><div>
      <h3>{incoming ? `Your person wants ${want}` : category.label}</h3>
      {item.care && <span className="along-request-care">{item.care}</span>}
      {item.note && <p>{item.note}</p>}
      {(!incoming || item.status !== "sent") && <span className={`along-request-state is-${item.status}`}>{["acknowledged", "completed"].includes(item.status) && <CheckCircle size={16} weight="fill" />}{requestStatusText[item.status]}</span>}
    </div></div>
    {tour && <small>Practice request · no one is notified</small>}
    <div className="along-request-actions">
      {incoming ? item.status === "acknowledged" ? <button className="along-requests-primary" disabled={pending} onClick={onComplete}>Done <CheckCircle size={20} /></button> : <>
        <button className="along-requests-primary" disabled={pending} onClick={onAcknowledge}>Got it <ArrowRight size={20} /></button>
        <button className="along-requests-text" disabled={pending} onClick={onUnavailable}>Can’t right now</button>
      </> : <>
        <button disabled={pending || item.status === "sending"} onClick={onEdit}><PencilSimple size={18} />Edit</button>
        <button disabled={pending} onClick={onCancel}><X size={18} />Cancel</button>
      </>}
    </div>
  </article>;
}

function RequestComposer({ category: categoryId, editing, tour, pending, error, onClose, onSubmit }: {
  category: RequestCategory; editing?: AlongRequest; tour: boolean; pending: boolean; error: string;
  onClose: () => void; onSubmit: (draft: RequestDraft) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [note, setNote] = useState(editing?.note || "");
  const [care, setCare] = useState<CareOption>(editing?.care || "Medicine");
  const category = requestCategories.find(category => category.id === categoryId)!;
  const required = categoryId === "grocery" || categoryId === "custom";
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    const viewport = window.visualViewport;
    const resize = () => {
      const inset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      node?.style.setProperty("--requests-keyboard", `${inset}px`);
      node?.style.setProperty("--requests-visible-height", `${viewport?.height || window.innerHeight}px`);
    };
    resize(); viewport?.addEventListener("resize", resize); viewport?.addEventListener("scroll", resize);
    return () => { node?.close(); viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); };
  }, []);
  return <dialog className="along-request-composer" ref={dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="request-composer-title">
    <div className="along-request-handle" aria-hidden="true" /><button className="along-request-close" onClick={onClose} disabled={pending} aria-label="Close request"><X size={22} /></button>
    <form onSubmit={event => { event.preventDefault(); if (!pending && (!required || note.trim())) void onSubmit({ category: categoryId, note: note.trim(), ...(categoryId === "care" ? { care } : {}) }); }}>
      <div className="along-request-composer-body">
        <img className="along-request-composer-art" src={category.image} alt="" width={100} height={100} />
        <h2 id="request-composer-title">{editing ? `Edit ${category.label.toLowerCase()}` : category.headline}</h2>
        {tour && <span className="along-request-tour-label">Tour mode · a practice request</span>}
        {categoryId === "care" && <fieldset><legend>Choose one</legend><div className="along-request-care-options">{careOptions.map(option => <label key={option}>
          <input type="radio" name="care" value={option} checked={care === option} onChange={() => setCare(option)} disabled={pending} /><span>{option}</span>
        </label>)}</div></fieldset>}
        <label className="along-request-note" htmlFor="request-note">{required ? "What do you need?" : <>Add a note <span>Optional</span></>}</label>
        <textarea id="request-note" value={note} onChange={event => setNote(event.target.value)} required={required} maxLength={280} rows={3} disabled={pending}
          placeholder={categoryId === "care" && care === "Sanitary pads" ? "Get the regular pads" : category.placeholder} />
        {error && <p className="along-requests-feedback" role="alert">{error}</p>}
      </div>
      <footer><button className="along-requests-primary" type="submit" disabled={pending || (required && !note.trim())}>{pending ? "Sending…" : editing ? "Save changes" : "Send request"}{!pending && <ArrowRight size={20} />}</button>
        <button className="along-requests-text" type="button" disabled={pending} onClick={onClose}>Cancel</button></footer>
    </form>
  </dialog>;
}
