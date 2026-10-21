import type { AppState } from "./types";

export interface RealtimeAdapter {
  load(): AppState | null;
  save(state: AppState): void;
  subscribe(listener: (state: AppState) => void): () => void;
}

export class LocalDemoRealtime implements RealtimeAdapter {
  constructor(private readonly key = "along.private-ride.v1") {}

  load() {
    if (typeof window === "undefined") return null;
    try {
      const value = window.localStorage.getItem(this.key);
      return value ? (JSON.parse(value) as AppState) : null;
    } catch {
      return null;
    }
  }

  save(state: AppState) {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(state));
      window.dispatchEvent(new CustomEvent("along:state", { detail: state }));
    } catch {
      // Storage can be unavailable in privacy mode; the in-memory app keeps working.
    }
  }

  subscribe(listener: (state: AppState) => void) {
    const local = (event: Event) => listener((event as CustomEvent<AppState>).detail);
    const storage = (event: StorageEvent) => {
      if (event.key === this.key && event.newValue) listener(JSON.parse(event.newValue) as AppState);
    };
    window.addEventListener("along:state", local);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("along:state", local);
      window.removeEventListener("storage", storage);
    };
  }
}

// Swap this instance for a Supabase/Firebase adapter without changing the UI.
export const realtime = new LocalDemoRealtime();
export const demoRealtime = new LocalDemoRealtime("along.private-ride.demo.v1");
