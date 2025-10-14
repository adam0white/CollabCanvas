import type { PresenceState } from "../hooks/usePresence";
import styles from "./App.module.css";

type PresenceBarProps = {
  roomId: string;
  presence: Map<number, PresenceState>;
  localPresence: PresenceState | null;
};

export function PresenceBar({ presence }: PresenceBarProps): JSX.Element {
  if (presence.size === 0) {
    return <div className={styles.presenceText}>No one else is here yet.</div>;
  }

  const participants = Array.from(presence.values());

  return (
    <div className={styles.presenceBar}>
      {participants.map((participant) => (
        <div
          key={`${participant.userId}-${participant.displayName}`}
          className={styles.presenceAvatar}
          style={{
            backgroundColor: participant.imageUrl
              ? "transparent"
              : participant.color,
            backgroundImage: participant.imageUrl
              ? `url(${participant.imageUrl})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          title={participant.displayName}
        >
          {!participant.imageUrl && initials(participant.displayName)}
        </div>
      ))}
      <span className={styles.presenceText}>
        {participants.length} {participants.length === 1 ? "person" : "people"}{" "}
        here
      </span>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
