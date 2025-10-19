import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import { useEffect, useRef, useState } from "react";
import { usePresence } from "../hooks/usePresence";
import { SelectionProvider } from "../hooks/useSelection";
import { ToolbarProvider } from "../hooks/useToolbar";
import { useViewport, ViewportProvider } from "../hooks/useViewport";
import { useShapes } from "../shapes/useShapes";
import { useConnectionStatus } from "../yjs/client";
import { AIPanel } from "./AIPanel";
import styles from "./App.module.css";
import { AppContent } from "./AppContent";
import { Footer } from "./Footer";
import { PresenceBar } from "./PresenceBar";
import { ShortcutsPanel } from "./ShortcutsPanel";

export function App(): React.JSX.Element {
  if (typeof window === "undefined") {
    throw new Error("App should only be rendered in a browser environment.");
  }

  const roomId =
    new URL(window.location.href).searchParams.get("roomId") ?? "main";
  const presenceState = usePresence();
  const connectionStatus = useConnectionStatus();
  const { isLoading: shapesLoading } = useShapes();
  const [isShortcutsPanelOpen, setIsShortcutsPanelOpen] = useState(false);
  const aiPanelRef = useRef<HTMLTextAreaElement>(null);
  const [defaultFillColor, setDefaultFillColor] = useState("#38bdf8");

  // Show loading only on initial load (when shapes are loading)
  // Don't block the UI during reconnection - show connection status badge instead
  const isLoading = shapesLoading;

  // Map connection status to display text
  const connectionStatusText = {
    connecting: "Connecting...",
    connected: "Connected",
    disconnected: "Disconnected",
  }[connectionStatus];

  const connectionStatusColor = {
    connecting: "rgba(245, 158, 11, 0.9)", // amber
    connected: "rgba(34, 197, 94, 0.9)", // green
    disconnected: "rgba(239, 68, 68, 0.9)", // red
  }[connectionStatus];

  // Global keyboard shortcuts (? for help)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input
      const target = e.target as HTMLElement;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable;

      if (isTyping) return;

      // ? to open shortcuts panel
      if (e.key === "?" && !e.shiftKey) {
        e.preventDefault();
        setIsShortcutsPanelOpen(true);
      }

      // / to focus AI input
      if (e.key === "/") {
        e.preventDefault();
        aiPanelRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <ToolbarProvider>
      <SelectionProvider>
        <ViewportProvider>
          <AppWithViewport
            presenceState={presenceState}
            connectionStatusText={connectionStatusText}
            connectionStatusColor={connectionStatusColor}
            roomId={roomId}
            isLoading={isLoading}
            defaultFillColor={defaultFillColor}
            setDefaultFillColor={setDefaultFillColor}
            aiPanelRef={aiPanelRef}
            isShortcutsPanelOpen={isShortcutsPanelOpen}
            setIsShortcutsPanelOpen={setIsShortcutsPanelOpen}
          />
        </ViewportProvider>
      </SelectionProvider>
    </ToolbarProvider>
  );
}

// Separate component to use viewport context
function AppWithViewport({
  presenceState,
  connectionStatusText,
  connectionStatusColor,
  roomId,
  isLoading,
  defaultFillColor,
  setDefaultFillColor,
  aiPanelRef,
  isShortcutsPanelOpen,
  setIsShortcutsPanelOpen,
}: {
  presenceState: ReturnType<typeof usePresence>;
  connectionStatusText: string;
  connectionStatusColor: string;
  roomId: string;
  isLoading: boolean;
  defaultFillColor: string;
  setDefaultFillColor: (color: string) => void;
  aiPanelRef: React.RefObject<HTMLTextAreaElement | null>;
  isShortcutsPanelOpen: boolean;
  setIsShortcutsPanelOpen: (open: boolean) => void;
}): React.JSX.Element {
  const { viewport } = useViewport();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>CollabCanvas</h1>
          <div
            className={styles.connectionStatus}
            style={{ backgroundColor: connectionStatusColor }}
          >
            <div className={styles.connectionDot} />
            {connectionStatusText}
          </div>
        </div>

        <PresenceBar
          presence={presenceState.presence}
          localPresence={presenceState.localPresence}
          roomId={roomId}
        />

        <div className={styles.headerRight}>
          <SignedOut>
            <SignInButton mode="modal" fallbackRedirectUrl="/c/main" />
          </SignedOut>
          <SignedIn>
            <UserButton userProfileUrl="/c/main" />
          </SignedIn>
        </div>
      </header>

      <main className={styles.main}>
        {isLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner} />
            <p>Connecting to canvas...</p>
          </div>
        )}

        <div className={styles.canvasContainer}>
          <AppContent
            presence={presenceState.presence}
            setPresence={presenceState.setPresence}
            defaultFillColor={defaultFillColor}
            onDefaultColorChange={setDefaultFillColor}
            floatingToolbarClassName={styles.floatingToolbar}
          />
        </div>

        {/* AI Panel with viewport context */}
        <aside className={styles.aiPanel}>
          <AIPanel
            ref={aiPanelRef}
            viewportCenter={viewport.center}
            viewportBounds={viewport.bounds}
            canvasScale={viewport.scale}
          />
        </aside>
      </main>

      <Footer />

      {/* Keyboard shortcuts help panel */}
      <ShortcutsPanel
        isOpen={isShortcutsPanelOpen}
        onClose={() => setIsShortcutsPanelOpen(false)}
      />
    </div>
  );
}
