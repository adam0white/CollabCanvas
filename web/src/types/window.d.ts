/**
 * Window type extensions for E2E testing
 * 
 * These globals are exposed in development/test environments only
 * to allow Playwright tests to access Yjs state for verification.
 */

import type { Doc } from 'yjs';
import type { WebsocketProvider } from 'y-websocket';

declare global {
  interface Window {
    /**
     * Yjs document instance (exposed for E2E tests)
     * Used to read shape state and verify synchronization
     */
    yjsDoc?: Doc;
    
    /**
     * Yjs WebSocket provider (exposed for E2E tests)
     * Used to check connection status and awareness state
     */
    yjsProvider?: WebsocketProvider;
  }
}

export {};
