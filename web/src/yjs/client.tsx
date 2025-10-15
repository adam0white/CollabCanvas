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

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

const DocContext = createContext<Doc | null>(null);
const AwarenessContext = createContext<Awareness | null>(null);
const RoomContext = createContext<string | null>(null);
const ConnectionStatusContext = createContext<ConnectionStatus>("connecting");

export function YjsProvider({
  children,
  roomId,
}: {
  children: React.ReactNode;
  roomId?: string;
}): React.JSX.Element {
  const resolvedRoomId = roomId ?? resolveRoomId();
  const { getToken } = useAuth();
  const doc = useMemo(() => new Doc(), []);
  const awareness = useMemo(() => new Awareness(doc), [doc]);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [contextValue] = useState<ProviderContextValue>(() => ({
    doc,
    awareness,
    roomId: resolvedRoomId,
  }));

  useEffect(() => {
    let cancelled = false;

    const initialise = async () => {
      const token = await getToken().catch(() => null);
      if (cancelled) return;

      const baseUrl = new URL(window.location.href);
      const protocol = baseUrl.protocol === "https:" ? "wss" : "ws";
      const serverUrl = `${protocol}://${baseUrl.host}/c/main/ws`;

      const provider = new WebsocketProvider(serverUrl, resolvedRoomId, doc, {
        awareness,
        connect: false,
        params: token ? { token } : {},
      });

      // Track all connection state changes
      provider.on("status", ({ status }: { status: string }) => {
        if (status === "connected") {
          setConnectionStatus("connected");
        } else if (status === "connecting") {
          setConnectionStatus("connecting");
        } else {
          setConnectionStatus("disconnected");
        }
      });

      // Sync event is more reliable for detecting when fully connected
      // Especially important after reconnection
      provider.on("sync", (isSynced: boolean) => {
        if (isSynced) {
          setConnectionStatus("connected");
        }
      });

      provider.on(
        "connection-error",
        (_event: Event, _provider: WebsocketProvider) => {
          setConnectionStatus("disconnected");
        },
      );

      provider.on(
        "connection-close",
        (_event: CloseEvent | null, _provider: WebsocketProvider) => {
          setConnectionStatus("disconnected");
        },
      );

      // Monitor browser online/offline events
      const handleOnline = () => {
        // Force disconnect then reconnect to ensure clean connection
        // The WebSocket might still appear "connected" but be dead after offline
        if (provider) {
          provider.disconnect();
          provider.shouldConnect = true;
          provider.connect();
        }
      };

      const handleOffline = () => {
        setConnectionStatus("disconnected");
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      provider.connect();
      providerRef.current = provider;

      // Store event handlers for cleanup
      (provider as any)._onlineHandler = handleOnline;
      (provider as any)._offlineHandler = handleOffline;
    };

    void initialise();

    return () => {
      cancelled = true;
      const provider = providerRef.current;
      providerRef.current = null;

      // Clean up browser event listeners
      if (provider) {
        const onlineHandler = (provider as any)._onlineHandler;
        const offlineHandler = (provider as any)._offlineHandler;
        if (onlineHandler) window.removeEventListener("online", onlineHandler);
        if (offlineHandler)
          window.removeEventListener("offline", offlineHandler);

        provider.disconnect();
        provider.destroy();
      }
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
          <ConnectionStatusContext.Provider value={connectionStatus}>
            {children}
          </ConnectionStatusContext.Provider>
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

export function useConnectionStatus(): ConnectionStatus {
  return useContext(ConnectionStatusContext);
}
