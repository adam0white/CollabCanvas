/**
 * Viewport context hook
 * Manages viewport state (pan/zoom) across the application for AI context awareness
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

export type ViewportState = {
  scale: number;
  position: { x: number; y: number };
  center: { x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
};

type ViewportContextValue = {
  viewport: ViewportState;
  setViewport: (update: Partial<ViewportState>) => void;
};

const ViewportContext = createContext<ViewportContextValue | null>(null);

export function ViewportProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [viewport, setViewportState] = useState<ViewportState>({
    scale: 1,
    position: { x: 0, y: 0 },
    center: { x: 1000, y: 1000 }, // Default canvas center
    bounds: { x: 0, y: 0, width: 2000, height: 2000 },
  });

  const setViewport = (update: Partial<ViewportState>) => {
    setViewportState((prev) => ({ ...prev, ...update }));
  };

  const value = useMemo(() => ({ viewport, setViewport }), [viewport]);

  return (
    <ViewportContext.Provider value={value}>
      {children}
    </ViewportContext.Provider>
  );
}

export function useViewport(): ViewportContextValue {
  const context = useContext(ViewportContext);
  if (!context) {
    throw new Error("useViewport must be used within ViewportProvider");
  }
  return context;
}
