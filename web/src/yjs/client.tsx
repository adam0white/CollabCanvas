/**
 * Yjs Client Provider Module
 *
 * Lifecycle:
 * 1. On mount: Creates Y.Doc and Awareness, connects WebSocket to DO with current Clerk token
 * 2. Token refresh: Listens to Clerk auth state changes; reconnects WebSocket with updated token
 * 3. Disconnect: On unmount, cleanly destroys provider and closes WebSocket connection
 * 4. Reconnect: y-websocket handles automatic reconnection with exponential backoff
 *
 * Authentication:
 * - Token passed via WebSocket URL params to enable server-side role assignment (editor/viewer)
 * - Unauthenticated clients default to viewer role (read-only)
 * - Token refresh triggers reconnect to update server-side role if auth state changes
 */

import { useAuth } from "@clerk/clerk-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Awareness } from "y-protocols/awareness";
import { WebsocketProvider } from "y-websocket";
import { Doc } from "yjs";

const FALLBACK_ROOM_ID = "main";

type ProviderContextValue = {
  doc: Doc;
  awareness: Awareness;
  roomId: string;
};

const DocContext = createContext<Doc | null>(null);
const AwarenessContext = createContext<Awareness | null>(null);
const RoomContext = createContext<string | null>(null);

export function YjsProvider({
  children,
  roomId,
}: {
  children: React.ReactNode;
  roomId?: string;
}): JSX.Element {
  const resolvedRoomId = roomId ?? resolveRoomId();
  const { getToken } = useAuth();
  const doc = useMemo(() => new Doc(), []);
  const awareness = useMemo(() => new Awareness(doc), [doc]);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [contextValue] = useState<ProviderContextValue>(() => ({
    doc,
    awareness,
    roomId: resolvedRoomId,
  }));

  useEffect(() => {
    let cancelled = false;
    let provider: WebsocketProvider | null = null;

    const initialise = async () => {
      const token = await getToken().catch(() => null);
      if (cancelled) return;

      const baseUrl = new URL(window.location.href);
      const protocol = baseUrl.protocol === "https:" ? "wss" : "ws";
      const serverUrl = `${protocol}://${baseUrl.host}/c/main/ws`;

      provider = new WebsocketProvider(serverUrl, resolvedRoomId, doc, {
        awareness,
        connect: false,
        params: token ? { token } : {},
      });

      provider.on("status", ({ status }) => {
        console.debug("yjs status", status);
      });

      provider.connect();
      providerRef.current = provider;
    };

    void initialise();

    return () => {
      cancelled = true;
      providerRef.current?.destroy();
      providerRef.current = null;
      provider?.destroy();
    };
  }, [awareness, doc, getToken, resolvedRoomId]);

  useEffect(() => {
    let cancelled = false;

    const refreshToken = async () => {
      const token = await getToken().catch(() => null);
      if (cancelled) return;

      const provider = providerRef.current;
      if (!provider) return;

      if (token) {
        provider.params.token = token;
      } else {
        delete provider.params.token;
      }

      provider.disconnect();
      provider.connect();
    };

    void refreshToken();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <DocContext.Provider value={contextValue.doc}>
      <AwarenessContext.Provider value={contextValue.awareness}>
        <RoomContext.Provider value={contextValue.roomId}>
          {children}
        </RoomContext.Provider>
      </AwarenessContext.Provider>
    </DocContext.Provider>
  );
}

function resolveRoomId(): string {
  if (typeof window === "undefined") return FALLBACK_ROOM_ID;
  const params = new URL(window.location.href).searchParams;
  return params.get("roomId") ?? FALLBACK_ROOM_ID;
}

export function useYDoc(): Doc {
  const ctx = useContext(DocContext);
  if (!ctx) throw new Error("useYDoc must be used within YjsProvider");
  return ctx;
}

export function useAwareness(): Awareness {
  const ctx = useContext(AwarenessContext);
  if (!ctx) throw new Error("useAwareness must be used within YjsProvider");
  return ctx;
}

export function useRoomId(): string {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error("useRoomId must be used within YjsProvider");
  return ctx;
}
