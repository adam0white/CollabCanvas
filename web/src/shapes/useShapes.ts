/**
 * useShapes hook - Manages Yjs <-> local state sync for shapes
 *
 * Responsibilities:
 * - Subscribe to Y.Map changes and update local state
 * - Provide methods to create, update, delete shapes
 * - Handle serialization between Y.Map and Shape types
 * - Auth-aware: only allow mutations if user is signed in
 */

import { useAuth, useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";
import { useYDoc } from "../yjs/client";
import type { Rectangle, Shape } from "./types";
import { createRectangle } from "./types";

type UseShapesReturn = {
  shapes: Shape[];
  canEdit: boolean;
  isLoading: boolean;
  createShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
};

export function useShapes(): UseShapesReturn {
  const doc = useYDoc();
  const { isSignedIn } = useAuth();
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Sync Yjs shapes to local state
  useEffect(() => {
    const shapesMap = doc.getMap("shapes");

    const updateShapes = () => {
      const newShapes: Shape[] = [];

      for (const [id, value] of shapesMap.entries()) {
        // Y.Map stores values - could be Y.Map or plain object after serialization
        const shapeData =
          value instanceof Map ? Object.fromEntries(value.entries()) : value;

        if (
          typeof shapeData === "object" &&
          shapeData !== null &&
          "id" in shapeData &&
          "type" in shapeData
        ) {
          // Validate and fix position data
          const x =
            typeof shapeData.x === "number" && !Number.isNaN(shapeData.x)
              ? shapeData.x
              : 0;
          const y =
            typeof shapeData.y === "number" && !Number.isNaN(shapeData.y)
              ? shapeData.y
              : 0;

          // Log warning if position was invalid
          if (shapeData.x !== x || shapeData.y !== y) {
            console.warn(
              `[Shape] Invalid position for shape ${id}: x=${shapeData.x}, y=${shapeData.y}. Defaulting to (0, 0)`,
            );
          }

          // Create validated shape with guaranteed valid position
          const validatedShape = {
            ...shapeData,
            x,
            y,
          } as Shape;

          newShapes.push(validatedShape);
        } else {
          console.warn(`[Shapes] Invalid shape data for ${id}:`, shapeData);
        }
      }

      setShapes(newShapes);
      setIsLoading(false); // Mark as loaded after first update
    };

    shapesMap.observe(updateShapes);
    updateShapes(); // Initial load

    return () => {
      shapesMap.unobserve(updateShapes);
    };
  }, [doc]);

  const createShape = (shape: Shape) => {
    if (!isSignedIn) {
      console.warn("[Shapes] Cannot create shape: user not signed in");
      return;
    }

    const shapesMap = doc.getMap("shapes");

    // Store shape as plain object - Yjs will handle serialization
    // We use JSON-compatible data only
    const shapeData: Record<string, unknown> = {
      id: shape.id,
      type: shape.type,
      x: shape.x,
      y: shape.y,
      fill: shape.fill,
      stroke: shape.stroke,
      strokeWidth: shape.strokeWidth,
      createdBy: shape.createdBy,
      createdAt: shape.createdAt,
      rotation: shape.rotation,
      aiGenerated: shape.aiGenerated,
    };

    // Add type-specific properties
    if (shape.type === "rectangle") {
      shapeData.width = shape.width;
      shapeData.height = shape.height;
    } else if (shape.type === "circle") {
      shapeData.radius = shape.radius;
    } else if (shape.type === "text") {
      shapeData.text = shape.text;
      shapeData.fontSize = shape.fontSize;
      shapeData.fontFamily = shape.fontFamily;
      shapeData.align = shape.align;
      shapeData.width = shape.width;
    }

    shapesMap.set(shape.id, shapeData);
  };

  const updateShape = (id: string, updates: Partial<Shape>) => {
    if (!isSignedIn) return;

    const shapesMap = doc.getMap("shapes");
    const existing = shapesMap.get(id);
    if (!existing) return;

    // Get current shape data
    const currentData =
      existing instanceof Map
        ? Object.fromEntries(existing.entries())
        : existing;

    // Validate position updates - ensure x and y are valid numbers
    const validatedUpdates = { ...updates };
    if ("x" in validatedUpdates) {
      const x = validatedUpdates.x;
      if (typeof x !== "number" || Number.isNaN(x)) {
        console.error(
          `[Shape] Invalid x position in update for ${id}: ${x}. Ignoring update.`,
        );
        delete validatedUpdates.x;
      }
    }
    if ("y" in validatedUpdates) {
      const y = validatedUpdates.y;
      if (typeof y !== "number" || Number.isNaN(y)) {
        console.error(
          `[Shape] Invalid y position in update for ${id}: ${y}. Ignoring update.`,
        );
        delete validatedUpdates.y;
      }
    }

    // Merge updates
    const updated = { ...currentData, ...validatedUpdates };
    shapesMap.set(id, updated);
  };

  const deleteShape = (id: string) => {
    if (!isSignedIn) return;

    const shapesMap = doc.getMap("shapes");
    shapesMap.delete(id);
  };

  /**
   * Batch create multiple shapes in a single Yjs transaction
   * This dramatically reduces network overhead for bulk operations
   */
  const batchCreateShapes = (shapes: Shape[]) => {
    if (!isSignedIn) {
      console.warn("[Shapes] Cannot create shapes: user not signed in");
      return;
    }

    // Use Yjs transaction to batch all creates into single network message
    doc.transact(() => {
      for (const shape of shapes) {
        createShape(shape);
      }
    });
  };

  /**
   * Batch update multiple shapes in a single Yjs transaction
   * Used for group operations like multi-select drag
   */
  const batchUpdateShapes = (updates: Array<{ id: string; updates: Partial<Shape> }>) => {
    if (!isSignedIn) return;

    // Use Yjs transaction to batch all updates into single network message
    doc.transact(() => {
      for (const update of updates) {
        updateShape(update.id, update.updates);
      }
    });
  };

  /**
   * Batch delete multiple shapes in a single Yjs transaction
   */
  const batchDeleteShapes = (ids: string[]) => {
    if (!isSignedIn) return;

    doc.transact(() => {
      for (const id of ids) {
        deleteShape(id);
      }
    });
  };

  return {
    shapes,
    canEdit: !!isSignedIn,
    isLoading,
    createShape,
    updateShape,
    deleteShape,
    // New batch operations for performance
    batchCreateShapes,
    batchUpdateShapes,
    batchDeleteShapes,
  };
}

/**
 * Helper hook to create rectangles with user context
 */
export function useCreateRectangle() {
  const { user } = useUser();
  const { createShape, canEdit } = useShapes();

  const createRect = (
    x: number,
    y: number,
    width: number,
    height: number,
  ): Rectangle | null => {
    if (!canEdit) return null;

    const userId = user?.id ?? "guest";
    const rect = createRectangle(x, y, width, height, userId);
    createShape(rect);
    return rect;
  };

  return { createRect, canEdit };
}
