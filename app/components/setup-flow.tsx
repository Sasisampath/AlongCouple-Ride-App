"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, X } from "lucide-react";
import type { Role } from "../lib/types";
import "./setup-flow.css";

export const SETUP_KEY = "along.setup.v1";
export type SetupChoice = { role: Role | null; avatar: string | null; complete: boolean };
export function readSetup(): SetupChoice {
  try {
    const value = JSON.parse(localStorage.getItem(SETUP_KEY) || "null");
    return { role: ["rider", "driver"].includes(value?.role) ? value.role : null,
      avatar: /^\/setup\/avatar-[1-8]\.png$/.test(value?.avatar || "") ? value.avatar : null,
      complete: value?.complete === true };
  } catch { return { role: null, avatar: null, complete: false }; }
}
function save(choice: SetupChoice) {
  try { localStorage.setItem(SETUP_KEY, JSON.stringify(choice)); } catch { /* Continue in memory. */ }
}

export function SetupFlow({ onComplete }: { onComplete: (choice: SetupChoice) => void }) {
  const [choice, setChoice] = useState<SetupChoice>(() => readSetup());
  const [step, setStep] = useState(0);
  const choose = (patch: Partial<SetupChoice>) => {
    const next = { ...choice, ...patch }; setChoice(next); save(next);
  };
  const next = () => {
    if (step === 0) setStep(1);
    else { const result = { ...choice, complete: true }; save(result); onComplete(result); }
  };
  return <main className="setup-shell">
    <header><img src="/brand/along-wordmark.png" alt="Along" /><button onClick={next}>Skip</button></header>
    <h1>{step === 0 ? <>How do you<br />usually ride?</> : <>Pick your<br /><em>Along</em></>}</h1>
    {step === 0 ? <>
      <div className="setup-hero"><img src="/setup/role-hero.png" alt="Two people riding a scooter together" /></div>
      <div className="setup-roles" role="group" aria-label="Your usual role">
        {([{ role: "driver", name: "Rider", image: "rider" }, { role: "rider", name: "Pillion", image: "pillion" }] as const).map(item =>
          <button key={item.role} aria-pressed={choice.role === item.role} onClick={() => choose({ role: item.role })}>
            <img src={`/setup/${item.image}.png`} alt="" /><strong>{item.name}</strong><i>{choice.role === item.role && <Check size={14} />}</i>
          </button>)}
      </div>
    </> : <div className="setup-avatars" role="group" aria-label="Choose your avatar">
      {Array.from({ length: 8 }, (_, i) => `/setup/avatar-${i + 1}.png`).map((src, i) =>
        <button key={src} aria-label={`Avatar ${i + 1}`} aria-pressed={choice.avatar === src} onClick={() => choose({ avatar: src })}>
          <img src={src} alt="" />{choice.avatar === src && <i><Check size={14} /></i>}
        </button>)}
    </div>}
    <footer><button className="setup-primary" onClick={next}>That’s me <ArrowRight size={21} /></button></footer>
  </main>;
}

export type AccountSession = { authenticated: boolean; signInUrl: string | null };
export function AccountGate({ session, pairing, onClose, partnerInvite }: { session: AccountSession; pairing: boolean; onClose: () => void; partnerInvite?: { code: string; url: string } }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [feedback, setFeedback] = useState("");
  const copyInvite = async () => {
    if (!partnerInvite) return;
    try { await navigator.clipboard.writeText(partnerInvite.url); setFeedback("Link copied"); }
    catch { setFeedback("Couldn’t copy. Select the invite link to copy it manually."); }
  };
  const shareInvite = async () => {
    if (!partnerInvite) return;
    if (!navigator.share) { await copyInvite(); return; }
    try { await navigator.share({ title: "Along", url: partnerInvite.url }); }
    catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setFeedback("Couldn’t share. Try copying the link."); }
  };
  useEffect(() => { ref.current?.showModal(); const node = ref.current; return () => node?.close(); }, []);
  const invite = pairing && session.authenticated;
  return <dialog ref={ref} className="setup-dialog" onCancel={onClose} aria-labelledby="account-title">
    <button className="setup-close" aria-label="Close" onClick={onClose}><X size={20} /></button>
    <img className="setup-account-art" src={invite ? "/setup/invite.png" : "/setup/sign-in.png"} alt="" />
    <h2 id="account-title">{invite ? "Bring your person Along" : "Ready to make it yours?"}</h2>
    {invite ? <>
      <label>Pairing code<input readOnly value={partnerInvite?.code ?? ""} placeholder="Not available yet" /></label>
      <label>Invite link<input readOnly value={partnerInvite?.url ?? ""} placeholder="Not available yet" /></label>
      {!partnerInvite && <p>Partner invites aren’t available yet. You can keep exploring Along.</p>}
      <button className="setup-primary" disabled={!partnerInvite} onClick={shareInvite}>Share invite</button><button className="setup-secondary" disabled={!partnerInvite} onClick={copyInvite}>Copy link</button>
      {feedback && <p role="status">{feedback}</p>}
    </> : <>
      {session.signInUrl ? <a className="setup-primary" href={session.signInUrl}>Continue with ChatGPT <ArrowRight size={19} /></a> : <p>Sign-in isn’t available in this version yet. You can keep exploring Along.</p>}
    </>}
    <button className="setup-secondary" onClick={onClose}>{invite ? "Skip for now" : "Not now"}</button>
  </dialog>;
}
