/**
 * AppContent - Main content wrapper that uses selection context
 */

import type { PresenceState } from "../hooks/usePresence";
import { useSelection } from "../hooks/useSelection";
import { useShapes } from "../shapes/useShapes";
import { Canvas } from "./Canvas";
import { LayersPanel } from "./LayersPanel";
import { Toolbar } from "./Toolbar";

interface AppContentProps {
  presence: Map<number, PresenceState>;
  setPresence: (
    update: Partial<PresenceState>,
    forceThrottle?: boolean,
  ) => void;
  defaultFillColor: string;
  onDefaultColorChange: (color: string) => void;
  floatingToolbarClassName?: string;
}

export function AppContent({
  presence,
  setPresence,
  defaultFillColor,
  onDefaultColorChange,
  floatingToolbarClassName,
}: AppContentProps): React.JSX.Element {
  const { shapes, updateShape, canEdit } = useShapes();
  const { selectedShapeIds, setSelectedShapeIds } = useSelection();

  return (
    <>
      {/* Floating toolbar */}
      <Toolbar
        className={floatingToolbarClassName}
        defaultColor={defaultFillColor}
        onDefaultColorChange={onDefaultColorChange}
      />

      <Canvas
        presence={presence}
        setPresence={setPresence}
        defaultFillColor={defaultFillColor}
      />

      {/* Layers Panel */}
      <LayersPanel
        shapes={shapes}
        selectedShapeIds={selectedShapeIds}
        canEdit={canEdit}
        onShapeSelect={(id) => setSelectedShapeIds([id])}
        onVisibilityToggle={(id, visible) => updateShape(id, { visible })}
        onLockToggle={(id, locked) => updateShape(id, { locked })}
        onReorder={(shapeId, newZIndex) =>
          updateShape(shapeId, { zIndex: newZIndex })
        }
      />
    </>
  );
}
