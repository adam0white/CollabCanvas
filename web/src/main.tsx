import { ClerkProvider } from "@clerk/clerk-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

import { App } from "./ui/App";

async function bootstrap(): Promise<void> {
  const rootElement = document.getElementById("root");

  if (!rootElement) {
    throw new Error("Failed to find root element");
  }

  const publishableKey = await resolvePublishableKey();

  if (!publishableKey) {
    console.error(
      "Missing Clerk publishable key; ClerkProvider cannot be initialised.",
    );
  }

  createRoot(rootElement).render(
    <StrictMode>
      <ClerkProvider publishableKey={publishableKey}>
        <App />
      </ClerkProvider>
    </StrictMode>,
  );
}

async function resolvePublishableKey(): Promise<string> {
  if (import.meta.env.DEV) {
    return import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
  }

  try {
    const response = await fetch("/clerk/config", { credentials: "include" });
    if (!response.ok) {
      console.error(
        "Failed to retrieve Clerk configuration",
        await response.text(),
      );
      return "";
    }

    const data = (await response.json()) as { publishableKey?: string };
    return data.publishableKey ?? "";
  } catch (error) {
    console.error("Error while loading Clerk configuration", error);
    return "";
  }
}

void bootstrap();
