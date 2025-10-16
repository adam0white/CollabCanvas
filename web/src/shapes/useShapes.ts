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
import type { Circle, Rectangle, Shape, TextShape } from "./types";
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
          newShapes.push(shapeData as Shape);
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

    // Merge updates
    const updated = { ...currentData, ...updates };
    shapesMap.set(id, updated);
  };

  const deleteShape = (id: string) => {
    if (!isSignedIn) return;

    const shapesMap = doc.getMap("shapes");
    shapesMap.delete(id);
  };

  return {
    shapes,
    canEdit: !!isSignedIn,
    isLoading,
    createShape,
    updateShape,
    deleteShape,
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
