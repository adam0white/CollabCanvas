import { useAuth } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useYDoc } from "../yjs/client";

/**
 * SharedCounter - Minimal proof that Yjs doc sync works
 * Demonstrates "basic shared state round-trip" for PR6 acceptance
 */
export function SharedCounter(): JSX.Element {
  const doc = useYDoc();
  const { isSignedIn } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const yMap = doc.getMap("demo");

    // Initialize if needed
    if (!yMap.has("counter")) {
      yMap.set("counter", 0);
    }

    // Subscribe to updates
    const updateCount = () => {
      setCount((yMap.get("counter") as number) || 0);
    };

    yMap.observe(updateCount);
    updateCount(); // Set initial value

    return () => {
      yMap.unobserve(updateCount);
    };
  }, [doc]);

  const increment = () => {
    const yMap = doc.getMap("demo");
    const current = (yMap.get("counter") as number) || 0;
    yMap.set("counter", current + 1);
  };

  return (
    <div
      style={{
        padding: "1rem",
        background: "rgba(14, 165, 233, 0.1)",
        borderRadius: "8px",
        display: "flex",
        gap: "1rem",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: "1.25rem", fontWeight: "600" }}>
        Shared Counter: {count}
      </span>
      <button
        type="button"
        onClick={increment}
        disabled={!isSignedIn}
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "6px",
          border: "1px solid rgba(15, 23, 42, 0.2)",
          background: isSignedIn ? "#0ea5e9" : "#94a3b8",
          color: "white",
          fontWeight: "600",
          cursor: isSignedIn ? "pointer" : "not-allowed",
        }}
        title={isSignedIn ? "Increment counter" : "Sign in to edit"}
      >
        +1
      </button>
      {!isSignedIn && (
        <span style={{ fontSize: "0.875rem", color: "rgba(15, 23, 42, 0.6)" }}>
          (Sign in to increment)
        </span>
      )}
    </div>
  );
}
