import { useAuth, useUser } from "@clerk/clerk-react";
import { useCallback, useMemo, useState } from "react";
import { useRoomId, useYDoc } from "../yjs/client";

export type AIContext = {
  selectedShapeIds?: string[];
  viewportCenter?: { x: number; y: number };
};

export type AIResult = {
  success: boolean;
  message?: string;
  error?: string;
  shapesCreated?: number;
  shapesAffected?: number;
  commandId: string;
};

export function useAI() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const roomId = useRoomId();
  const doc = useYDoc();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canUseAI = useMemo(() => !!isSignedIn, [isSignedIn]);

  const send = useCallback(
    async (prompt: string, ctx?: AIContext): Promise<AIResult | null> => {
      setError(null);
      if (!canUseAI) {
        setError("Sign in to use AI");
        return null;
      }
      setLoading(true);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      try {
        const token = await getToken().catch(() => null);
        const url = `/c/${encodeURIComponent(roomId)}/ai-command`;
        const commandId = crypto.randomUUID();
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ prompt, context: ctx ?? {}, commandId }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error ?? `Request failed: ${res.status}`);
        }

        const data = (await res.json()) as AIResult;
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return null;
      } finally {
        clearTimeout(timeout);
        setLoading(false);
      }
    },
    [canUseAI, getToken, roomId],
  );

  return {
    send,
    loading,
    error,
    canUseAI,
    user,
    doc,
  } as const;
}
