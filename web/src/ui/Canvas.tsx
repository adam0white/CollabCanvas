import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Layer, Rect, Stage } from "react-konva";

import type { PresenceState } from "../hooks/usePresence";
import styles from "./Canvas.module.css";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 600;

type CanvasProps = {
  presence: Map<number, PresenceState>;
  setPresence: (state: Partial<PresenceState>) => void;
};

export function Canvas({ presence, setPresence }: CanvasProps): JSX.Element {
  const stageRef = useRef<Konva.Stage | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const handleMouseMove = () => {
      const pointerPosition = stage.getPointerPosition();
      if (!pointerPosition) return;
      setPresence({ cursor: pointerPosition });
    };

    const handleMouseLeave = () => {
      setPresence({ cursor: null });
    };

    stage.on("mousemove", handleMouseMove);
    stage.on("mouseleave", handleMouseLeave);

    return () => {
      stage.off("mousemove", handleMouseMove);
      stage.off("mouseleave", handleMouseLeave);
      setPresence({ cursor: null });
    };
  }, [setPresence]);

  const remoteCursors = Array.from(presence.values()).filter(
    (participant) => participant.cursor,
  );

  return (
    <div className={styles.canvasWrapper}>
      <Stage
        ref={stageRef}
        className={styles.stage}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        tabIndex={0}
      >
        <Layer>
          <Rect
            x={CANVAS_WIDTH / 2 - 120}
            y={CANVAS_HEIGHT / 2 - 60}
            width={240}
            height={120}
            cornerRadius={12}
            fill="#38bdf8"
            shadowBlur={16}
            shadowOpacity={0.1}
          />

          {remoteCursors.map((participant) => {
            if (!participant.cursor) return null;
            return (
              <Rect
                key={`${participant.userId}-cursor`}
                x={participant.cursor.x}
                y={participant.cursor.y}
                width={12}
                height={12}
                fill={participant.color}
                cornerRadius={4}
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
