/**
 * Footer component with legal links
 */

import styles from "./Footer.module.css";

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.links}>
        <a href="/privacy" target="_blank" rel="noopener noreferrer">
          Privacy Policy
        </a>
        <span className={styles.separator}>•</span>
        <a href="/terms" target="_blank" rel="noopener noreferrer">
          Terms of Service
        </a>
        <span className={styles.separator}>•</span>
        <a
          href="https://github.com/adam0white/CollabCanvas"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
}
