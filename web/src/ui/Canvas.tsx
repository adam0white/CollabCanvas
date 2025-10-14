import { Layer, Rect, Stage } from "react-konva";

import styles from "./Canvas.module.css";

const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 600;

export function Canvas(): JSX.Element {
  return (
    <div className={styles.canvasWrapper}>
      <Stage
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
        </Layer>
      </Stage>
    </div>
  );
}
