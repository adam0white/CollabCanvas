/**
 * Selection context hook
 * Manages selected shape IDs across the application
 */

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

type SelectionContextValue = {
  selectedShapeIds: string[];
  setSelectedShapeIds: (ids: string[]) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);

  const value = useMemo(
    () => ({ selectedShapeIds, setSelectedShapeIds }),
    [selectedShapeIds],
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionContextValue {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used within SelectionProvider");
  }
  return context;
}
