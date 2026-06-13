"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { track } from "@vercel/analytics";

// Open/close state for the map drawer. This is ephemeral UI state, not a shareable view, so it
// lives in React rather than the URL: toggling is instant and never triggers a server round-trip,
// which is what lets the drawer animate the moment it is clicked. The selected suburb stays in the
// URL (that part is shareable); only the panel's open state is local.

type MapDrawerValue = {
  open: boolean;
  // True once the drawer has been opened at least once. The heavy map mounts on first open and
  // stays mounted afterwards, so reopening is instant and the boundary file is not refetched.
  hasOpened: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const MapDrawerContext = createContext<MapDrawerValue | null>(null);

export function MapDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  // Record the first open as it happens, in the handler rather than an effect, so the heavy map can
  // mount on first open and stay mounted afterwards.
  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (next) {
      setHasOpened(true);
      track("map_opened");
    }
  }, []);

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  const value = useMemo<MapDrawerValue>(
    () => ({ open, hasOpened, setOpen, toggle }),
    [open, hasOpened, setOpen, toggle],
  );

  return <MapDrawerContext.Provider value={value}>{children}</MapDrawerContext.Provider>;
}

export function useMapDrawer(): MapDrawerValue {
  const context = useContext(MapDrawerContext);
  if (!context) throw new Error("useMapDrawer must be used within a MapDrawerProvider");
  return context;
}
