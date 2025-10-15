/**
 * Shared toolbar state hook
 * Manages active tool selection across components
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

export type Tool = "select" | "rectangle";

type ToolbarContextValue = {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
};

const ToolbarContext = createContext<ToolbarContextValue | null>(null);

export function ToolbarProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [activeTool, setActiveTool] = useState<Tool>("select");

  const value = useMemo(() => ({ activeTool, setActiveTool }), [activeTool]);

  return (
    <ToolbarContext.Provider value={value}>{children}</ToolbarContext.Provider>
  );
}

export function useToolbar(): ToolbarContextValue {
  const context = useContext(ToolbarContext);
  if (!context) {
    throw new Error("useToolbar must be used within ToolbarProvider");
  }
  return context;
}
