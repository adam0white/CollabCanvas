/**
 * useLocking - Manages shape locking via Yjs Awareness
 * 
 * Features:
 * - Broadcast locks when shapes are selected
 * - Check if shapes are locked by other users
 * - Clean up stale locks (30s timeout)
 * - Visual feedback for locked shapes
 */

import { useEffect, useMemo } from "react";
import { usePresence } from "./usePresence";

const STALE_LOCK_TIMEOUT_MS = 30000; // 30 seconds

export type ShapeLock = {
  userId: string;
  displayName: string;
  color: string;
  timestamp: number;
};

export type LockingHook = {
  lockedShapes: Map<string, ShapeLock>; // shapeId -> lock info
  isShapeLocked: (shapeId: string, currentUserId: string) => boolean;
  getLockOwner: (shapeId: string) => ShapeLock | null;
  updateLocks: (selectedShapeIds: string[]) => void;
};

export function useLocking(currentUserId: string): LockingHook {
  const { presence, setPresence, localPresence } = usePresence();

  // Build map of locked shapes from all users' presence
  const lockedShapes = useMemo(() => {
    const locks = new Map<string, ShapeLock>();
    const now = Date.now();

    for (const [, state] of presence.entries()) {
      // Skip if this is the local user
      if (state.userId === currentUserId) continue;

      // Skip if no locked shapes
      if (!state.lockedShapeIds || state.lockedShapeIds.length === 0) continue;

      // Check if lock is stale
      const lockAge = state.lockTimestamp ? now - state.lockTimestamp : 0;
      if (lockAge > STALE_LOCK_TIMEOUT_MS) {
        // Lock is stale, skip it
        continue;
      }

      // Add locks for each shape
      for (const shapeId of state.lockedShapeIds) {
        // First lock wins (if multiple users somehow lock the same shape)
        if (!locks.has(shapeId)) {
          locks.set(shapeId, {
            userId: state.userId,
            displayName: state.displayName,
            color: state.color,
            timestamp: state.lockTimestamp ?? now,
          });
        }
      }
    }

    return locks;
  }, [presence, currentUserId]);

  // Update local locks when selection changes
  const updateLocks = (selectedShapeIds: string[]) => {
    setPresence({
      lockedShapeIds: selectedShapeIds,
      lockTimestamp: Date.now(),
    });
  };

  // Check if a shape is locked by another user
  const isShapeLocked = (shapeId: string, userId: string): boolean => {
    const lock = lockedShapes.get(shapeId);
    return lock !== null && lock !== undefined && lock.userId !== userId;
  };

  // Get the lock owner for a shape
  const getLockOwner = (shapeId: string): ShapeLock | null => {
    return lockedShapes.get(shapeId) ?? null;
  };

  // Clean up stale locks periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Check if local locks are stale (shouldn't happen, but safety check)
      if (localPresence?.lockTimestamp) {
        const age = now - localPresence.lockTimestamp;
        if (age > STALE_LOCK_TIMEOUT_MS && localPresence.lockedShapeIds?.length) {
          // Clear stale local locks
          setPresence({
            lockedShapeIds: [],
            lockTimestamp: now,
          });
        }
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [localPresence, setPresence]);

  return {
    lockedShapes,
    isShapeLocked,
    getLockOwner,
    updateLocks,
  };
}
