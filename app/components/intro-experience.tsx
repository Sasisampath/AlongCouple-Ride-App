"use client";
/* eslint-disable @next/next/no-img-element -- supplied transparent artwork is used directly, without cropping or regeneration. */

import { ArrowRight, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { completeIntro, introAssets, readIntroState, saveIntroPage } from "../lib/intro";
import { splashTiming } from "../lib/splash";
import { BrandSplash } from "./brand-splash";
import "@fontsource-variable/bricolage-grotesque/wght.css";
import "@fontsource-variable/inter/wght.css";
import "./intro-experience.css";

const slides = [
  {
    name: "Stay close",
    title: <>Stay <em>close</em></>,
    image: introAssets.waiting,
    cta: "Let’s go",
  },
  {
    name: "See the distance",
    title: <>See the<br /><em>distance</em></>,
    image: introAssets.journey,
    cta: "Show me",
  },
  {
    name: "Share little joys",
    title: <>Share<br /><em>little joys</em></>,
    image: introAssets.requests,
    cta: "Love that",
  },
  {
    name: "Keep every moment",
    title: <>Keep every<br /><em>moment</em></>,
    image: introAssets.together,
    cta: "Get started",
  },
];

function ApprovedWordmark() {
  return (
    <span className="intro-wordmark">
      <img src={introAssets.wordmarkWhite} alt="Along" width={1448} height={1086} fetchPriority="high" draggable={false} />
    </span>
  );
}

export function SignInPlaceholder({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);

  return (
    <dialog ref={dialog} className="intro-signin" onCancel={onClose} aria-labelledby="intro-signin-title">
      <button className="intro-close" onClick={onClose} aria-label="Close sign in"><X size={20} /></button>
      <ApprovedWordmark />
      <h2 id="intro-signin-title">Welcome <em>back.</em></h2>
      <p>Sign-in is coming soon. You can still get started on this device.</p>
      <button className="intro-cta" onClick={onStart}>Get started <ArrowRight size={21} aria-hidden="true" /></button>
      <button className="intro-signin-back" onClick={onClose}>Back to Along</button>
    </dialog>
  );
}

function IntroCarousel({ initialPage, preview, onComplete }: { initialPage: number; preview: boolean; onComplete: () => void }) {
  const [page, setPage] = useState(initialPage);
  const [direction, setDirection] = useState(1);
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const transitioning = useRef(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const slide = slides[page];

  useEffect(() => () => {
    if (transitionTimer.current) clearTimeout(transitionTimer.current);
  }, []);

  useEffect(() => {
    if (!preview) {
      try { saveIntroPage(window.localStorage, page); } catch { /* Storage may be disabled. */ }
    }
    // Warm the next finished PNG only, keeping the initial request small.
    const next = slides[page + 1];
    if (next) {
      const image = new Image();
      image.src = next.image;
    }
    if (focusHeading.current) {
      heading.current?.focus({ preventScroll: true });
      focusHeading.current = false;
    }
  }, [page, preview]);

  const goTo = (next: number, focus = false) => {
    const target = Math.max(0, Math.min(slides.length - 1, next));
    if (transitioning.current || target === page) return;
    transitioning.current = true;
    transitionTimer.current = setTimeout(() => { transitioning.current = false; }, 330);
    focusHeading.current = focus;
    setDirection(target > page ? 1 : -1);
    setPage(target);
  };

  const endSwipe = (event: PointerEvent<HTMLElement>) => {
    const start = pointer.current;
    pointer.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      goTo(page + (dx < 0 ? 1 : -1));
    }
  };

  return (
    <main className={`intro-shell intro-story intro-slide-${page + 1}`}>
      <section
        className="intro-story-stage"
        aria-label="About Along"
        aria-roledescription="carousel"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={endSwipe}
        onPointerCancel={() => { pointer.current = null; }}
      >
        <article key={page} className={`intro-slide ${direction < 0 ? "intro-backward" : ""}`} aria-label={`${page + 1} of 4: ${slide.name}`} aria-roledescription="slide">
          <div className="intro-copy">
            <h1 ref={heading} tabIndex={-1}>{slide.title}</h1>
          </div>

          <div className="intro-artwork">
            <img src={slide.image} alt="" width={1254} height={1254} fetchPriority="high" draggable={false} />
          </div>
        </article>
      </section>

      <footer className="intro-footer">
        <nav className="intro-pagination" aria-label="Onboarding pages">
          {slides.map((item, index) => <button key={item.name} onClick={() => goTo(index, true)} aria-label={`Page ${index + 1}: ${item.name}`} aria-current={index === page ? "step" : undefined}><span /></button>)}
        </nav>
        <button className="intro-cta" onClick={() => page === 3 ? onComplete() : goTo(page + 1, true)}>{slide.cta}<ArrowRight size={22} strokeWidth={2} aria-hidden="true" /></button>
      </footer>
    </main>
  );
}

export function IntroExperience({ children }: { children: (backToIntro: () => void) => ReactNode }) {
  const [phase, setPhase] = useState<"splash" | "reveal" | "story" | "app">("splash");
  const [initialPage, setInitialPage] = useState(0);
  const [preview, setPreview] = useState(false);
  const [startup, setStartup] = useState<{ ready: boolean; reducedMotion: boolean; target: "story" | "app"; holdAt?: number }>({ ready: false, reducedMotion: false, target: "story" });
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const isPreview = import.meta.env.DEV && query.get("intro") === "preview";
    let saved = { complete: false, page: 0 };
    try { saved = readIntroState(window.localStorage); } catch { /* Use in-memory state. */ }
    // Restore storage after hydration, never during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(isPreview);
    const target = saved.complete && !isPreview ? "app" : "story";
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches || (isPreview && query.get("motion") === "reduce");
    const timing = splashTiming(reducedMotion);
    const frame = Number(query.get("at"));
    const holdAt = isPreview && query.get("splash") === "hold" && Number.isFinite(frame) ? Math.max(0, Math.min(timing.complete - 1, frame)) : undefined;
    setStartup({ ready: true, reducedMotion, target, holdAt });
    setPhase("splash");
    const requested = Number(query.get("slide") || 1) - 1;
    setInitialPage(isPreview && Number.isInteger(requested) ? Math.max(0, Math.min(3, requested)) : saved.page);
    // Warm the first illustration during the pen sequence. Nothing remote is
    // required; the SVG is inline and the final PNG is packaged with the app.
    if (target === "story") {
      const first = new Image();
      first.src = slides[isPreview ? Math.max(0, Math.min(3, Number.isInteger(requested) ? requested : 0)) : saved.page].image;
    }
    if (holdAt !== undefined) return;
    const reveal = setTimeout(() => setPhase("reveal"), timing.reveal);
    const finish = setTimeout(() => setPhase(target), timing.complete);
    const loop = isPreview && query.get("splash") === "loop" ? setTimeout(() => setReplay((value) => value + 1), timing.complete + 2000) : undefined;
    return () => { clearTimeout(reveal); clearTimeout(finish); if (loop) clearTimeout(loop); };
  }, [replay]);

  useEffect(() => {
    if (phase === "app") return;
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const original = theme?.content;
    if (theme) theme.content = phase === "story" ? "#FBF8F4" : "#07111F";
    return () => { if (theme && original) theme.content = original; };
  }, [phase]);

  const app = () => children(() => {
    setInitialPage(3);
    setPhase("story");
  });
  const story = () => <IntroCarousel initialPage={initialPage} preview={preview} onComplete={() => {
    if (!preview) {
      try { completeIntro(window.localStorage); } catch { /* Entering setup still works. */ }
    }
    setPhase("app");
  }} />;
  const destination = phase === "app" || phase === "story" ? phase : startup.target;
  return <div className="intro-entry" data-splash={phase === "splash" || phase === "reveal"}>
    {phase !== "splash" && <div inert={phase === "reveal" ? true : undefined} aria-hidden={phase === "reveal" ? true : undefined}>{destination === "app" ? app() : story()}</div>}
    {(phase === "splash" || phase === "reveal") && <BrandSplash key={replay} ready={startup.ready} reducedMotion={startup.reducedMotion} holdAt={startup.holdAt} />}
  </div>;
}
