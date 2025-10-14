import styles from "./App.module.css";
import { Canvas } from "./Canvas";
import { Toolbar } from "./Toolbar";

export function App(): JSX.Element {
  if (typeof window === "undefined") {
    throw new Error("App should only be rendered in a browser environment.");
  }

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>CollabCanvas</h1>
        <p className={styles.subtitle}>Real-time collaborative canvas MVP</p>
      </header>

      <Toolbar className={styles.toolbar} />

      <main className={styles.main}>
        <Canvas />
      </main>
    </div>
  );
}
