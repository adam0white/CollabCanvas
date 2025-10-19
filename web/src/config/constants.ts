/**
 * Application-wide constants
 *
 * Centralized configuration for throttle settings, performance targets,
 * and other shared constants.
 */

/**
 * Adaptive throttle configuration for real-time updates
 * Automatically adjusts based on operation complexity
 * Target: ≤20 msgs/sec per operation (cursor + transform = 40 msgs/sec max per client)
 */
export const THROTTLE = {
  /** Cursor/presence updates in milliseconds */
  PRESENCE_MS: 50,
  /** Transform operations (drag/resize/rotate) in milliseconds */
  TRANSFORM_MS: 50,
  /** Aggressive throttling for medium selections (10-20 shapes) */
  TRANSFORM_MS_MEDIUM_SELECTION: 100,
  /** Aggressive throttling for large selections (20+ shapes) */
  TRANSFORM_MS_LARGE_SELECTION: 150,
  /** Ultra-aggressive throttling for very large selections (50+ shapes) */
  TRANSFORM_MS_XLARGE_SELECTION: 250,
  /** Color/style changes in milliseconds */
  COLOR_CHANGE_MS: 100,
} as const;

/**
 * Get adaptive throttle delay based on selection size
 * Performance: Larger selections = more aggressive throttling
 */
export function getAdaptiveThrottleMs(selectionSize: number): number {
  if (selectionSize >= 50) return THROTTLE.TRANSFORM_MS_XLARGE_SELECTION;
  if (selectionSize >= 20) return THROTTLE.TRANSFORM_MS_LARGE_SELECTION;
  if (selectionSize >= 10) return THROTTLE.TRANSFORM_MS_MEDIUM_SELECTION;
  return THROTTLE.TRANSFORM_MS;
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
  /** Maximum shapes per AI command */
  MAX_SHAPES_PER_COMMAND: 50,
  /** Maximum prompt length in characters */
  MAX_PROMPT_LENGTH: 1000,
  /** AI command timeout in milliseconds */
  COMMAND_TIMEOUT_MS: 10000,
} as const;
