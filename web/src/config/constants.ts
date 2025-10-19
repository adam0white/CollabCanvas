/**
 * Application-wide constants
 *
 * Centralized configuration for throttle settings, performance targets,
 * and other shared constants.
 */

/**
 * Adaptive throttle configuration for real-time updates
 * Dynamically scales based on operation complexity
 * Target: Balance responsiveness with network efficiency
 */
export const THROTTLE = {
  /** Base throttle for single shape operations */
  BASE_MS: 50,
  /** Cursor/presence updates in milliseconds */
  PRESENCE_MS: 50,
  /** Per-shape overhead in milliseconds (adds to base) */
  PER_SHAPE_MS: 4,
  /** Maximum throttle delay (cap at 500ms for UX) */
  MAX_MS: 500,
  /** Color/style changes in milliseconds */
  COLOR_CHANGE_MS: 100,
} as const;

/**
 * Calculate adaptive throttle delay based on selection size
 *
 * Formula: base + (perShape * selectionSize), capped at max
 *
 * Examples:
 * - 1 shape:   50ms (20 updates/sec) - highly responsive
 * - 10 shapes: 90ms (11 updates/sec) - smooth
 * - 50 shapes: 250ms (4 updates/sec) - efficient
 * - 100 shapes: 500ms (2 updates/sec) - maximum throttle
 *
 * Performance: Scales linearly with complexity, prevents network spam
 */
export function getAdaptiveThrottleMs(selectionSize: number): number {
  const calculated = THROTTLE.BASE_MS + THROTTLE.PER_SHAPE_MS * selectionSize;
  return Math.min(calculated, THROTTLE.MAX_MS);
}

/**
 * Target message rate per operation
 */
export const MESSAGE_RATE_TARGET = 20; // messages per second

/**
 * Layout operation spacing defaults
 */
export const LAYOUT = {
  /** Default spacing between shapes in layout operations */
  DEFAULT_SPACING: 20,
} as const;

/**
 * AI command limits
 */
export const AI = {
  /** Maximum shapes per AI command (increased from 50 to 1000 with optimizations) */
  MAX_SHAPES_PER_COMMAND: 1000,
  /** Maximum prompt length in characters */
  MAX_PROMPT_LENGTH: 1000,
  /** AI command timeout in milliseconds (increased to 60s for simulated execution) */
  COMMAND_TIMEOUT_MS: 60000,
} as const;

/**
 * AI Agent visual constants
 */
export const AI_AGENT = {
  /** AI agent cursor color (purple) */
  COLOR: "#9333ea",
  /** Base delay for pattern creation (ms) */
  PATTERN_BASE_DELAY: 200,
  /** Additional delay per shape in pattern (ms) */
  PATTERN_PER_SHAPE_DELAY: 10,
  /** Maximum delay for pattern creation (ms) */
  PATTERN_MAX_DELAY: 1000,
  /** Base delay for shape creation (ms) */
  SHAPE_BASE_DELAY: 150,
  /** Additional delay per shape (ms) */
  SHAPE_PER_SHAPE_DELAY: 20,
  /** Maximum delay for shape creation (ms) */
  SHAPE_MAX_DELAY: 800,
  /** Delay for arrange operations base (ms) */
  ARRANGE_BASE_DELAY: 150,
  /** Additional delay per shape in arrange (ms) */
  ARRANGE_PER_SHAPE_DELAY: 15,
  /** Maximum delay for arrange operations (ms) */
  ARRANGE_MAX_DELAY: 600,
  /** Delay for style updates (ms) */
  STYLE_UPDATE_DELAY: 100,
  /** Delay for move operations (ms) */
  MOVE_DELAY: 150,
  /** Delay for delete operations (ms) */
  DELETE_DELAY: 120,
  /** Delay for rotate operations (ms) */
  ROTATE_DELAY: 120,
  /** Delay for resize operations (ms) */
  RESIZE_DELAY: 150,
  /** Delay between operations for visual separation (ms) */
  OPERATION_SEPARATION_DELAY: 50,
} as const;
