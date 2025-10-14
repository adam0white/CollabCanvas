import { YDurableObjects } from "y-durableobjects";

import {
  createDebouncedCommit,
  type DebouncedCommitController,
} from "./utils/debounced-storage";

export const ROOM_PERSIST_IDLE_MS = 500;
export const ROOM_PERSIST_MAX_MS = 2000;

type DurableBindings = {
  Bindings: Env;
};

export class RoomDO extends YDurableObjects<DurableBindings> {
  private readonly commitScheduler: DebouncedCommitController;
  private readonly sockets = new Set<WebSocket>();

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);

    this.commitScheduler = createDebouncedCommit({
      commit: () => this.storage.commit(),
      idleMs: ROOM_PERSIST_IDLE_MS,
      maxMs: ROOM_PERSIST_MAX_MS,
      waitUntil: (promise) => {
        void this.state.waitUntil(promise);
      },
    });

    this.doc.awareness.on("update", () => {
      this.commitScheduler.schedule();
    });
  }

  protected override async onStart(): Promise<void> {
    await super.onStart();

    this.doc.on("update", () => {
      this.commitScheduler.schedule();
    });
  }

  override async updateYDoc(update: Uint8Array): Promise<void> {
    await super.updateYDoc(update);
    this.commitScheduler.schedule();
  }

  protected override registerWebSocket(ws: WebSocket): void {
    super.registerWebSocket(ws);
    this.sockets.add(ws);
  }

  protected override async unregisterWebSocket(ws: WebSocket): Promise<void> {
    this.sockets.delete(ws);
    await super.unregisterWebSocket(ws);
    if (this.sockets.size < 1) {
      await this.commitScheduler.flush();
    }
  }

  protected override async cleanup(): Promise<void> {
    if (this.sockets.size < 1) {
      await this.commitScheduler.flush();
    }

    await super.cleanup();
  }
}
