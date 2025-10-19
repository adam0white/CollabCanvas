/**
 * AppContent - Main content wrapper that uses selection context
 */

import { useSelection } from "../hooks/useSelection";
import { useShapes } from "../shapes/useShapes";
import { LayersPanel } from "./LayersPanel";

export function AppContent(): React.JSX.Element {
  const { shapes, updateShape, canEdit } = useShapes();
  const { selectedShapeIds, setSelectedShapeIds } = useSelection();

  return (
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
  );
}
