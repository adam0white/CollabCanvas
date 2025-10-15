import { ClerkProvider } from "@clerk/clerk-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import "./index.css";

import { App } from "./ui/App";
import { PrivacyPolicy } from "./ui/PrivacyPolicy";
import { TermsOfService } from "./ui/TermsOfService";
import { YjsProvider } from "./yjs/client";

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
      <BrowserRouter>
        <Routes>
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route
            path="*"
            element={
              <ClerkProvider publishableKey={publishableKey}>
                <YjsProvider>
                  <App />
                </YjsProvider>
              </ClerkProvider>
            }
          />
        </Routes>
      </BrowserRouter>
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
