import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { useState } from "react";
import { useAI } from "../hooks/useAI";

export function AIPanel(): React.JSX.Element {
  const { send, canUseAI, loading, error } = useAI();
  const [prompt, setPrompt] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    await send(prompt.trim());
    setPrompt("");
  };

  return (
    <div style={{ position: "absolute", right: 16, top: 72, width: 320 }}>
      <div style={{ padding: 12, background: "rgba(17,24,39,0.9)", color: "#fff", borderRadius: 8 }}>
        <h3 style={{ margin: 0, marginBottom: 8, fontSize: 14 }}>AI Assistant</h3>
        <form onSubmit={onSubmit}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={canUseAI ? "Describe what to create or move..." : "Sign in to use AI"}
            disabled={!canUseAI || loading}
            rows={3}
            style={{ width: "100%", resize: "vertical", padding: 8, borderRadius: 6 }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <button type="submit" disabled={!canUseAI || loading || !prompt.trim()}>
              {loading ? "AI is thinking…" : "Send"}
            </button>
            {error && (
              <span style={{ color: "#f87171", fontSize: 12 }}>
                {error}
              </span>
            )}
          </div>
        </form>
        <SignedOut>
          <p style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
            Guests can view but cannot send AI commands.
          </p>
        </SignedOut>
        <SignedIn>
          <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
            Try: "Create a red rectangle at 100, 200"
          </p>
        </SignedIn>
      </div>
    </div>
  );
}
