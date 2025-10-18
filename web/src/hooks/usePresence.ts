import { useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAwareness } from "../yjs/client";

export type PresenceState = {
  userId: string;
  displayName: string;
  color: string;
  cursor: { x: number; y: number } | null;
  imageUrl?: string; // Profile picture URL for authenticated users
  lockedShapeIds?: string[]; // Shape IDs currently locked by this user
  lockTimestamp?: number; // Timestamp when lock was acquired
};

type PresenceHook = {
  presence: Map<number, PresenceState>;
  localPresence: PresenceState | null;
  setPresence: (state: Partial<PresenceState>, forceThrottle?: boolean) => void;
};

// Expanded color palette with broader spectrum
const COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#f43f5e", // rose
];
const UPDATE_INTERVAL_MS = 50;
const UPDATE_INTERVAL_MS_THROTTLED = 150; // More aggressive throttling for large selections

/**
 * Sanitize display name to prevent XSS attacks
 * Removes potentially dangerous characters and limits length
 */
function sanitizeDisplayName(name: string): string {
  return name
    .replace(/[<>'"&]/g, "") // Remove HTML-like characters
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim()
    .slice(0, 50); // Limit length
}

export function usePresence(): PresenceHook {
  const awareness = useAwareness();
  const { user } = useUser();

  const userId = user?.id ?? `guest-${awareness.clientID}`;

  const [presenceMap, setPresenceMap] = useState<Map<number, PresenceState>>(
    new Map(),
  );

  // Calculate display name for authenticated users or guest number based on clientID
  const displayName = useMemo(() => {
    if (user?.fullName || user?.username) {
      const rawName = user.fullName ?? user.username ?? "Guest";
      return sanitizeDisplayName(rawName);
    }

    // For guests, use a stable number derived from clientID
    // This ensures each guest has a consistent identity without recalculating
    return `Guest ${(awareness.clientID % 100) + 1}`;
  }, [user, awareness.clientID]);

  const color = useMemo(() => randomColor(userId), [userId]);
  const imageUrl = user?.imageUrl;
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const baseState: PresenceState = {
      userId,
      displayName,
      color,
      cursor: null,
      ...(imageUrl && { imageUrl }),
    };

    awareness.setLocalState({ presence: baseState });

    return () => {
      awareness.setLocalState(null);
    };
  }, [awareness, userId, displayName, color, imageUrl]);

  useEffect(() => {
    const updatePresence = () => {
      const next = new Map<number, PresenceState>();
      for (const [clientId, state] of awareness.getStates()) {
        const presenceState = state?.presence as PresenceState | undefined;
        if (presenceState) {
          next.set(clientId, presenceState);
        }
      }
      setPresenceMap(next);
    };

    awareness.on("update", updatePresence);
    updatePresence();

    return () => {
      awareness.off("update", updatePresence);
    };
  }, [awareness]);

  const setPresence = (state: Partial<PresenceState>, forceThrottle = false) => {
    const now = performance.now();
    const throttleInterval = forceThrottle ? UPDATE_INTERVAL_MS_THROTTLED : UPDATE_INTERVAL_MS;
    
    if (now - lastUpdateRef.current < throttleInterval) {
      return;
    }
    lastUpdateRef.current = now;

    const current = (awareness.getLocalState()?.presence as
      | PresenceState
      | undefined) ?? {
      userId,
      displayName,
      color,
      cursor: null,
    };

    awareness.setLocalState({
      presence: {
        ...current,
        ...state,
      },
    });
  };

  const localPresence =
    (awareness.getLocalState()?.presence as PresenceState | undefined) ?? null;

  return {
    presence: presenceMap,
    localPresence,
    setPresence,
  };
}

function randomColor(id: string): string {
  const hash = Array.from(id).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0,
  );
  return COLORS[hash % COLORS.length];
}
