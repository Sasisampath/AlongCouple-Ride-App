"use client";

import { useId, type CSSProperties } from "react";
import { introAssets } from "../lib/intro";
import { wordmarkStrokes } from "../lib/splash";
import "./brand-splash.css";

export function BrandSplash({ ready, reducedMotion, holdAt }: {
  ready: boolean;
  reducedMotion: boolean;
  holdAt?: number;
}) {
  const id = useId().replace(/:/g, "");
  const style = { "--splash-at": `${holdAt ?? 0}ms` } as CSSProperties;
  return (
    <div className="brand-splash" data-ready={ready} data-reduced-motion={reducedMotion} data-held={holdAt !== undefined} style={style} role="img" aria-label="Along — go together.">
      <link rel="preload" as="image" href={introAssets.wordmarkWhite} />
      <svg className="brand-splash-atmosphere" viewBox="0 0 430 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M-170 190C45 14 340 30 275 271S12 578 166 733 434 808 510 1020M570-170C360 143 133 84 108 313S273 512 220 680 36 796-85 1004" />
      </svg>
      <div className="brand-splash-lockup">
        <svg className="brand-splash-logo" viewBox="0 0 1448 1086" aria-hidden="true">
          <defs>
            {/* Static isolation of the existing dot, not a wipe of the logo.
                The two images use the same optimized source and unchanged coordinates. */}
            <mask id={`${id}-letters`} maskUnits="userSpaceOnUse" x="0" y="0" width="1448" height="1086">
              <path d="M0 0H1448V1086H0Z" fill="white" />
              <circle cx="1272" cy="626" r="60" fill="black" />
            </mask>
            <clipPath id={`${id}-dot`}><circle cx="1272" cy="626" r="60" /></clipPath>
          </defs>
          <g className="brand-splash-tracing" fill="none" stroke="#F7F3EC" strokeLinecap="round" strokeLinejoin="round">
            {wordmarkStrokes.map((stroke) => <path key={stroke.letter} data-letter={stroke.letter} d={stroke.d} pathLength="1" vectorEffect="non-scaling-stroke" strokeWidth="1.7" className="brand-splash-stroke" style={{ "--stroke-start": `${stroke.start}ms`, "--stroke-duration": `${stroke.duration}ms` } as CSSProperties} />)}
          </g>
          <image className="brand-splash-solid" href={introAssets.wordmarkWhite} width="1448" height="1086" mask={`url(#${id}-letters)`} />
          <g className="brand-splash-dot"><image href={introAssets.wordmarkWhite} width="1448" height="1086" clipPath={`url(#${id}-dot)`} /></g>
        </svg>
        <p className="brand-splash-tagline" aria-hidden="true">go together.</p>
      </div>
    </div>
  );
}
