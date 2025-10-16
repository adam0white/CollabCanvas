import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import { usePresence } from "../hooks/usePresence";
import { ToolbarProvider } from "../hooks/useToolbar";
import { useShapes } from "../shapes/useShapes";
import { useConnectionStatus } from "../yjs/client";
import styles from "./App.module.css";
import { Canvas } from "./Canvas";
import { Footer } from "./Footer";
import { PresenceBar } from "./PresenceBar";
import { Toolbar } from "./Toolbar";
import { AIPanel } from "./AIPanel";

export function App(): React.JSX.Element {
  if (typeof window === "undefined") {
    throw new Error("App should only be rendered in a browser environment.");
  }

  const roomId =
    new URL(window.location.href).searchParams.get("roomId") ?? "main";
  const presenceState = usePresence();
  const connectionStatus = useConnectionStatus();
  const { isLoading: shapesLoading } = useShapes();

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

  return (
    <ToolbarProvider>
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

          {/* Floating toolbar */}
          <Toolbar className={styles.floatingToolbar} />

          <Canvas
            presence={presenceState.presence}
            setPresence={presenceState.setPresence}
          />
          <AIPanel />
        </main>

        <Footer />
      </div>
    </ToolbarProvider>
  );
}
