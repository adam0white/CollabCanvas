import { useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAwareness } from "../yjs/client";

export type PresenceState = {
  userId: string;
  displayName: string;
  color: string;
  cursor: { x: number; y: number } | null;
};

type PresenceHook = {
  presence: Map<number, PresenceState>;
  localPresence: PresenceState | null;
  setPresence: (state: Partial<PresenceState>) => void;
};

const COLORS = ["#f97316", "#22c55e", "#3b82f6", "#ec4899", "#eab308"];
const UPDATE_INTERVAL_MS = 50;

export function usePresence(): PresenceHook {
  const awareness = useAwareness();
  const { user } = useUser();

  const userId = user?.id ?? `guest-${awareness.clientID}`;
  const displayName = user?.fullName ?? user?.username ?? "Guest";
  const color = useMemo(() => randomColor(userId), [userId]);

  const [presenceMap, setPresenceMap] = useState<Map<number, PresenceState>>(
    new Map(),
  );
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const baseState: PresenceState = {
      userId,
      displayName,
      color,
      cursor: null,
    };

    awareness.setLocalState({ presence: baseState });

    return () => {
      awareness.setLocalState(null);
    };
  }, [awareness, userId, displayName, color]);

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

  const setPresence = (state: Partial<PresenceState>) => {
    const now = performance.now();
    if (now - lastUpdateRef.current < UPDATE_INTERVAL_MS) {
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
