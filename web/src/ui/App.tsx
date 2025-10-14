import {
  SignedIn,
  SignedOut,
  SignInButton,
  UserButton,
} from "@clerk/clerk-react";
import { usePresence } from "../hooks/usePresence";
import { ToolbarProvider } from "../hooks/useToolbar";
import styles from "./App.module.css";
import { Canvas } from "./Canvas";
import { PresenceBar } from "./PresenceBar";
import { Toolbar } from "./Toolbar";

export function App(): JSX.Element {
  if (typeof window === "undefined") {
    throw new Error("App should only be rendered in a browser environment.");
  }

  const roomId =
    new URL(window.location.href).searchParams.get("roomId") ?? "main";
  const presenceState = usePresence();

  return (
    <ToolbarProvider>
      <div className={styles.app}>
        <header className={styles.header}>
          <h1 className={styles.title}>CollabCanvas</h1>
          <p className={styles.subtitle}>Real-time collaborative canvas MVP</p>
          <div className={styles.userControls}>
            <SignedOut>
              <SignInButton mode="modal" fallbackRedirectUrl="/c/main" />
            </SignedOut>
            <SignedIn>
              <UserButton userProfileUrl="/c/main" />
            </SignedIn>
          </div>
          <PresenceBar
            presence={presenceState.presence}
            localPresence={presenceState.localPresence}
            roomId={roomId}
          />
        </header>

        <Toolbar className={styles.toolbar} />

        <main className={styles.main}>
          <Canvas
            presence={presenceState.presence}
            setPresence={presenceState.setPresence}
          />
        </main>
      </div>
    </ToolbarProvider>
  );
}
