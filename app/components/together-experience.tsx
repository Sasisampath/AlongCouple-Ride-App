"use client";
/* eslint-disable @next/next/no-img-element -- approved transparent assets and original user photos. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, CalendarDots, CameraPlus, CheckCircle, ChatCircleDots, Heart, UserCircle, UserPlus, X } from "@phosphor-icons/react";
import { readTourRequests, requestCategories, requestDate } from "../lib/requests";
import { completedLittleMoments, emptyTogetherData, formatTogetherDate, isMemoryPhoto, loadLocalMemories, localDate, readTogetherText, relationshipDays, saveLocalMemory, saveTogetherText, starterQuestion, togetherAssets, type TogetherAnswer, type TogetherData, type TogetherMemory, type TogetherPair, type TogetherSync } from "../lib/together";
import "./together-experience.css";

type Props = { authenticated: boolean; demoMode: boolean; selectedAvatar: string | null; onConnect: () => void; pair?: TogetherPair; sync?: TogetherSync };
type Sheet = "answer" | "memory" | "date" | null;

export function TogetherExperience(props: Props) {
  // Scope all local state to an authenticated pair; Tour never consumes pair data.
  return <TogetherPanel key={props.demoMode ? "demo" : props.authenticated && props.pair ? props.pair.id : props.authenticated ? "unpaired" : "guest"} {...props} />;
}

function TogetherPanel({ authenticated, demoMode, selectedAvatar, onConnect, pair: suppliedPair, sync }: Props) {
  const pair = authenticated && !demoMode ? suppliedPair : undefined;
  const [exploring, setExploring] = useState(demoMode);
  const tour = exploring && !pair;
  const [data, setData] = useState<TogetherData>(emptyTogetherData);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [answer, setAnswer] = useState(() => {
    if (pair) return "";
    try { return localStorage.getItem("along.together.tour-answer-draft.v1")?.slice(0, 500) || ""; } catch { return ""; }
  });
  const [date, setDate] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(pair));
  const [celebrate, setCelebrate] = useState(false);
  const [tourMoments, setTourMoments] = useState(() => completedLittleMoments(readTourRequests(demoMode ? "along.requests.demo.v1" : "along.requests.tour.v1")));
  const busy = useRef(false);
  const mounted = useRef(true);
  const photoInput = useRef<HTMLInputElement>(null);
  const question = starterQuestion;
  const [today, setToday] = useState(localDate);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => setToday(localDate()), 60_000);
    return () => { mounted.current = false; clearInterval(timer); };
  }, []);
  useEffect(() => {
    if (!pair) return;
    let current = true, revision = 0;
    const unsubscribe = sync?.subscribe(next => { revision++; if (current) setData(next); });
    const initialRevision = revision;
    const load = async () => {
      if (sync) return sync.load();
      const text = readTogetherText(localStorage, pair.id);
      let memories: TogetherMemory[] = [];
      try { memories = await loadLocalMemories(pair.id); }
      catch { if (current) setError("Photos on this device couldn’t be loaded. You can still use your date and answers."); }
      return { ...emptyTogetherData(), ...text, memories };
    };
    load().then(next => {
      if (!current || revision !== initialRevision) return;
      setData(next); setAnswer(next.answers.find(item => item.questionId === question.id)?.text || ""); setDate(next.startDate || "");
    }).catch(() => { if (current) setError("Couldn’t load your shared story. Try reopening Together."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; unsubscribe?.(); };
  }, [pair, sync, question.id]);
  useEffect(() => {
    if (!tour) return;
    const refresh = () => setTourMoments(completedLittleMoments(readTourRequests(demoMode ? "along.requests.demo.v1" : "along.requests.tour.v1")));
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [tour, demoMode]);
  useEffect(() => {
    if (!celebrate) return;
    const timer = setTimeout(() => setCelebrate(false), 1800);
    return () => clearTimeout(timer);
  }, [celebrate]);

  const open = (next: Sheet) => { setFeedback(""); setError(""); setSheet(next); };
  const connect = () => { setSheet(null); onConnect(); };
  const save = async (kind: Exclude<Sheet, null>) => {
    if (busy.current) return;
    if (!pair) {
      if (kind === "answer") {
        try { localStorage.setItem("along.together.tour-answer-draft.v1", answer); } catch { /* Keep the draft in memory. */ }
      }
      connect(); return;
    }
    busy.current = true; setPending(true); setError("");
    try {
      let next = data;
      if (kind === "date") {
        if (relationshipDays(date, today) === null) { setError("Choose a valid date, today or earlier."); return; }
        if (sync) await sync.saveDate(date);
        else saveTogetherText(localStorage, pair.id, { startDate: date, answers: data.answers });
        next = { ...data, startDate: date };
      } else if (kind === "answer") {
        if (!answer.trim()) return;
        const entry: TogetherAnswer = { questionId: question.id, question: question.text, text: answer.trim(), savedAt: Date.now() };
        const answers = [entry, ...data.answers.filter(item => item.questionId !== entry.questionId)];
        if (sync) await sync.saveAnswer(entry);
        else saveTogetherText(localStorage, pair.id, { startDate: data.startDate, answers });
        next = { ...data, answers };
      } else {
        if (!photo || !isMemoryPhoto(photo)) return;
        const memory: TogetherMemory = { id: crypto.randomUUID(), photo, caption: caption.trim(), createdAt: Date.now() };
        if (sync) await sync.saveMemory(memory);
        else await saveLocalMemory(pair.id, memory);
        next = { ...data, memories: [memory, ...data.memories] };
      }
      if (!mounted.current) return;
      setData(next); setSheet(null);
      setFeedback(kind === "memory" ? sync ? "Memory saved" : "Memory saved on this device" : kind === "answer" ? sync ? "Answer sent" : "Answer saved on this device" : sync ? "Your date is saved" : "Your date is saved on this device");
      if (kind === "memory") { setPhoto(null); setCaption(""); setCelebrate(true); }
    } catch { if (mounted.current) setError("Couldn’t save that. Your draft is still here. Check your connection or device storage and try again."); }
    finally { busy.current = false; if (mounted.current) setPending(false); }
  };
  const pickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!isMemoryPhoto(file)) { setError("Choose a photo up to 15 MB (JPG, PNG, WebP, GIF, AVIF or HEIC)."); return; }
    setPhoto(file); setError(""); setSheet("memory");
  };
  const days = pair ? relationshipDays(data.startDate, today) : null;
  const savedAnswer = pair ? data.answers.find(item => item.questionId === question.id) : undefined;
  const moments = tour ? tourMoments : pair ? completedLittleMoments(data.completedRequests) : [];

  return <section className="along-together" aria-label="Together">
    <header className="along-together-header"><h1>Together</h1>{tour && <span className="along-home-status"><i />Tour mode</span>}</header>
    {!pair && !tour ? <article className="along-together-invite">
      <img src="/setup/invite.png" alt="Two people connecting with Along" width={160} height={160} />
      <h2>Bring your<br />person Along</h2>
      <button className="along-together-primary" onClick={onConnect}><UserPlus size={20} />Invite your person</button>
      <button className="along-together-text" onClick={() => setExploring(true)}>Explore first</button>
    </article> : <>
      <article className="along-together-story">
        <div className="along-together-avatars" aria-label={tour ? "Preview couple avatars" : "Your selected couple avatars"}>
          <Avatar src={pair?.ownAvatar || selectedAvatar} label="Your avatar" />
          <Avatar src={pair ? pair.partnerAvatar : "/setup/avatar-7.png"} label={tour ? "Tour partner avatar" : "Your person’s avatar"} />
          <Heart size={19} weight="fill" aria-hidden="true" />
        </div>
        <div className="along-together-story-copy"><div><h2>{days === null ? "Your story together" : <>Together for {days} {days === 1 ? "day" : "days"} <span>❤️</span></>}</h2>
          <button disabled={loading} onClick={() => { setDate(data.startDate || date); open("date"); }}><CalendarDots size={16} />{days === null ? "Add your date" : formatTogetherDate(data.startDate!)}</button>
        </div><img src={togetherAssets.milestone} alt="" width={64} height={64} /></div>
        {pair && !sync && <small>Saved on this device</small>}
      </article>
      {loading && <p className="along-together-feedback" role="status">Opening your story…</p>}
      <section className="along-together-section" aria-labelledby="together-question"><h2 id="together-question">Question for us</h2>
        <article className="along-together-question">
          <div><img src={togetherAssets.question} alt="" width={78} height={78} /><p>{question.text}</p></div>
          {tour && <small>Tour question</small>}
          {savedAnswer && <blockquote>{savedAnswer.text}<small>{sync ? "Your answer" : "Your answer · saved on this device"}</small></blockquote>}
          <button className="along-together-link" disabled={loading} onClick={() => open("answer")}><ChatCircleDots size={18} />{savedAnswer ? "Edit your answer" : "Answer together"}<ArrowRight size={18} /></button>
        </article>
      </section>
      <section className="along-together-section" aria-labelledby="together-memories"><div className="along-together-section-heading"><h2 id="together-memories">Memories</h2>{data.memories.length > 0 && <button className="along-together-icon" onClick={() => open("memory")} aria-label="Add a memory"><CameraPlus size={22} /></button>}</div>
        {data.memories.length ? <div className="along-together-memories">{data.memories.map(memory => <article key={memory.id}>
          <MemoryPhoto photo={memory.photo} caption={memory.caption} />
          <div>{memory.caption && <p>{memory.caption}</p>}<time dateTime={new Date(memory.createdAt).toISOString()}>{requestDate(memory.createdAt)}</time></div>
        </article>)}</div> : <article className="along-together-add-memory"><img src={togetherAssets.memory} alt="" width={88} height={94} /><div><h3>Keep a little moment</h3>
          <button className="along-together-link" disabled={loading} onClick={() => open("memory")}><CameraPlus size={18} />Add a memory</button></div></article>}
      </section>
      {moments.length > 0 && <section className="along-together-section" aria-labelledby="together-little"><h2 id="together-little">Little moments</h2>{tour && <p className="along-together-caption">From your Tour requests</p>}
        <div className="along-together-moments">{moments.map(item => {
          const category = requestCategories.find(category => category.id === item.category);
          if (!category) return null;
          return <article key={item.id}><img src={category.image} alt="" width={48} height={48} /><div><strong>{category.label}</strong><span>Done ❤️</span></div><time dateTime={new Date(item.updatedAt).toISOString()}>{requestDate(item.updatedAt)}</time></article>;
        })}</div>
      </section>}
      {pair && days !== null && <section className="along-together-section" aria-labelledby="together-milestones"><h2 id="together-milestones">Milestones</h2><article className="along-together-milestone"><img src={togetherAssets.milestone} alt="" width={68} height={68} /><div><strong>Our beginning</strong><span>{formatTogetherDate(data.startDate!)}</span></div></article></section>}
      {tour && <button className="along-together-text along-together-exit" onClick={() => setExploring(false)}>Back to your story</button>}
    </>}
    {feedback && <p className="along-together-feedback" role="status">{celebrate && <img className="along-together-spark" src={togetherAssets.spark} alt="" width={42} height={42} />}<CheckCircle size={18} />{feedback}</p>}
    {error && !sheet && <p className="along-together-feedback" role="alert">{error}</p>}
    {sheet && <TogetherSheet title={sheet === "answer" ? "Question for us" : sheet === "date" ? "Our beginning" : "Keep a little moment"} pending={pending} onClose={() => { if (!pending) { setSheet(null); setError(""); } }}>
      <form onSubmit={event => { event.preventDefault(); void save(sheet); }}>
        <div className="along-together-sheet-body">
          {tour && <span className="along-together-tour-note">Tour mode · connect to save your story</span>}
          {sheet === "answer" ? <><p className="along-together-sheet-question">{question.text}</p><label htmlFor="together-answer">Your answer</label><textarea id="together-answer" value={answer} onChange={event => setAnswer(event.target.value)} maxLength={500} rows={4} required disabled={pending} placeholder="A little thing, a good moment…" /></>
            : sheet === "date" ? <><img className="along-together-sheet-art" src={togetherAssets.milestone} alt="" width={90} height={90} /><label htmlFor="together-date">When did your story begin?</label><input id="together-date" type="date" max={today} value={date} onChange={event => setDate(event.target.value)} required disabled={pending} /></>
              : <><input className="along-together-file" ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif" aria-label="Choose a memory photo" onChange={event => { pickPhoto(event.target.files?.[0]); event.target.value = ""; }} />
                {photo ? <MemoryPhoto photo={photo} caption="Selected memory photo" /> : <img className="along-together-sheet-art" src={togetherAssets.memory} alt="" width={104} height={110} />}
                <button className="along-together-pick-photo" type="button" disabled={pending} onClick={() => photoInput.current?.click()}><CameraPlus size={21} />{photo ? "Choose another photo" : "Choose a photo"}</button>
                {photo && <><label htmlFor="together-caption">A little caption <span>Optional</span></label><textarea id="together-caption" value={caption} onChange={event => setCaption(event.target.value)} maxLength={180} rows={2} placeholder="Something to remember…" disabled={pending} /></>}
              </>}
          {pair && !sync && <p className="along-together-local-note">Saved only on this device. Your person won’t see it yet.</p>}
          {error && <p className="along-together-feedback" role="alert">{error}</p>}
        </div>
        <footer><button className="along-together-primary" type="submit" disabled={pending || (sheet === "answer" ? !answer.trim() : sheet === "date" ? relationshipDays(date, today) === null : !photo)}>
          {pending ? "Saving…" : sheet === "answer" ? "Send answer" : sheet === "date" ? "Save our date" : "Save memory"}<ArrowRight size={20} />
        </button><button className="along-together-text" type="button" disabled={pending} onClick={() => setSheet(null)}>Not now</button></footer>
      </form>
    </TogetherSheet>}
  </section>;
}

function Avatar({ src, label }: { src?: string | null; label: string }) {
  return <span>{src ? <img src={src} alt={label} width={64} height={64} /> : <UserCircle size={52} aria-label={label} weight="light" />}</span>;
}
function MemoryPhoto({ photo, caption }: { photo: Blob; caption: string }) {
  const image = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { const next = URL.createObjectURL(photo); if (image.current) image.current.src = next; return () => URL.revokeObjectURL(next); }, [photo]);
  return <>{failed && <p className="along-together-photo-error">This photo can’t be displayed here. Try choosing a JPG or PNG.</p>}<img ref={image} hidden={failed} className="along-together-user-photo" alt={caption || "A saved moment"} onLoad={() => setFailed(false)} onError={() => setFailed(true)} /></>;
}
function TogetherSheet({ title, pending, onClose, children }: { title: string; pending: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current; node?.showModal();
    const viewport = window.visualViewport;
    const resize = () => {
      node?.style.setProperty("--together-keyboard", `${viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0}px`);
      node?.style.setProperty("--together-visible-height", `${viewport?.height || window.innerHeight}px`);
    };
    resize(); viewport?.addEventListener("resize", resize); viewport?.addEventListener("scroll", resize);
    return () => { node?.close(); viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize); };
  }, []);
  return <dialog ref={dialog} className="along-together-sheet" onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="together-sheet-title">
    <div className="along-together-handle" aria-hidden="true" /><button className="along-together-close" onClick={onClose} disabled={pending} aria-label="Close Together sheet"><X size={22} /></button>
    <h2 id="together-sheet-title">{title}</h2>{children}
  </dialog>;
}
