"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * First-visit splash screen. Server-rendered so the logo is on screen from
 * the very first paint (the page can never flash through it), then fades
 * out after a ~2.6s hold — long enough to register the brand without
 * getting in the way. Shown once per browser session; every later
 * navigation in the same tab skips it entirely.
 *
 * Pure overlay — it renders above the app and unmounts completely, so no
 * existing page, layout, or workflow is touched.
 */

const SESSION_KEY = "bizmate.splash.seen";

/** True when this browser session has already seen the splash. */
export function splashAlreadySeen(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "fading" | "done">("visible");

  useEffect(() => {
    if (splashAlreadySeen()) {
      // Already shown this session: unmount right after hydration (no fade).
      const timer = setTimeout(() => setPhase("done"), 30);
      return () => clearTimeout(timer);
    }
    // The flag is written when the fade starts (not on mount): React's
    // StrictMode runs effects twice in development, and writing on mount
    // made the second run think the splash had already played.
    const fadeTimer = setTimeout(() => {
      setPhase("fading");
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // Private mode without storage: splash simply shows every visit.
      }
    }, 2600);
    const doneTimer = setTimeout(() => setPhase("done"), 3300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-700 ease-out ${
        phase === "fading" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="relative flex items-center justify-center">
        {/* Subtle breathing ring behind the logo */}
        <span className="absolute h-40 w-40 animate-splash-pulse rounded-full bg-brand-500/10 sm:h-52 sm:w-52" />
        <Image
          src="/bizmate-logo.png"
          alt="BizMate"
          width={320}
          height={72}
          priority
          className="relative h-auto w-64 sm:w-80"
        />
      </div>
    </div>
  );
}
