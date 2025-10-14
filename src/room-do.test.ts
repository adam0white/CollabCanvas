import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyUpdate, Doc, encodeStateAsUpdate } from "yjs";

vi.mock("y-durableobjects", async () => {
  const { applyUpdate, Doc, encodeStateAsUpdate } = await import("yjs");
  const { Awareness } = await import("y-protocols/awareness");

  class DocWithAwareness extends Doc {
    awareness: InstanceType<typeof Awareness>;

    constructor() {
      super();
      this.awareness = new Awareness(this);
    }
  }

  class MockTransactionStorage {
    constructor(
      private readonly backing: InMemoryStorage,
      private readonly doc: Doc,
    ) {}

    async commit(): Promise<void> {
      const snapshot = encodeStateAsUpdate(this.doc);
      await this.backing.put("ydoc:state:doc", snapshot);
    }
  }

  class MockYDurableObjects {
    protected readonly doc: DocWithAwareness;
    protected readonly storage: MockTransactionStorage;
    protected readonly sessions = new Map<WebSocket, () => void>();

    constructor(
      protected readonly state: MockDurableObjectState,
      protected readonly env: Env,
    ) {
      this.doc = new DocWithAwareness();
      this.storage = new MockTransactionStorage(state.storage, this.doc);

      void this.state.blockConcurrencyWhile(async () => {
        await this.onStart();
      });
    }

    protected async onStart(): Promise<void> {
      const snapshot =
        await this.state.storage.get<Uint8Array>("ydoc:state:doc");
      if (snapshot) {
        applyUpdate(this.doc, snapshot);
      }
    }

    protected registerWebSocket(ws: WebSocket): void {
      this.sessions.set(ws, () => {});
    }

    protected async unregisterWebSocket(ws: WebSocket): Promise<void> {
      this.sessions.delete(ws);
    }

    async updateYDoc(update: Uint8Array): Promise<void> {
      applyUpdate(this.doc, update);
    }

    protected async cleanup(): Promise<void> {
      await this.storage.commit();
    }
  }

  return {
    YDurableObjects: MockYDurableObjects,
  };
});

import { ROOM_PERSIST_IDLE_MS, RoomDO } from "./room-do";

class InMemoryStorage {
  constructor(private readonly store: Map<string, unknown>) {}

  private clone<T>(value: T): T {
    if (value instanceof Uint8Array) {
      return value.slice() as T;
    }
    if (value instanceof Map) {
      return new Map(value) as T;
    }
    if (Array.isArray(value)) {
      return [...value] as T;
    }
    if (value && typeof value === "object") {
      return structuredClone(value);
    }
    return value;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const value = this.store.get(key) as T | undefined;
    return value === undefined ? undefined : this.clone(value);
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.store.set(key, this.clone(value));
  }

  async list<T = unknown>(options?: {
    prefix?: string;
  }): Promise<Map<string, T>> {
    const prefix = options?.prefix ?? "";
    const entries = [...this.store.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, this.clone(value) as T] as const);
    return new Map(entries);
  }

  async delete(key: string | string[]): Promise<void> {
    const keys = Array.isArray(key) ? key : [key];
    for (const entry of keys) {
      this.store.delete(entry);
    }
  }

  async transaction<T>(
    closure: (txn: Omit<InMemoryStorage, "transaction">) => Promise<T>,
  ): Promise<T> {
    const txn = {
      get: this.get.bind(this),
      list: this.list.bind(this),
      put: this.put.bind(this),
      delete: this.delete.bind(this),
    } satisfies Omit<InMemoryStorage, "transaction">;
    return closure(txn);
  }
}

class MockDurableObjectState {
  readonly storage: InMemoryStorage;
  private readonly waiters: Promise<unknown>[] = [];

  constructor(store: Map<string, unknown>) {
    this.storage = new InMemoryStorage(store);
  }

  blockConcurrencyWhile<T>(closure: () => Promise<T>): Promise<T> {
    return closure();
  }

  waitUntil(promise: Promise<unknown>): void {
    this.waiters.push(promise);
  }

  async drainWaitUntil(): Promise<void> {
    if (this.waiters.length === 0) {
      return;
    }
    const tasks = [...this.waiters];
    this.waiters.length = 0;
    await Promise.all(tasks);
  }

  getWebSockets(): WebSocket[] {
    return [];
  }

  acceptWebSocket(): void {}
}

describe("RoomDO persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("persists a snapshot after idle debounce", async () => {
    const backing = new Map<string, unknown>();
    const state = new MockDurableObjectState(backing);
    const env = {} as Env;
    const room = new RoomDO(state as unknown as DurableObjectState, env);

    const clientDoc = new Doc();
    clientDoc.getMap("canvas").set("color", "green");
    const update = encodeStateAsUpdate(clientDoc);

    await room.updateYDoc(update);

    await vi.advanceTimersByTimeAsync(ROOM_PERSIST_IDLE_MS);
    await state.drainWaitUntil();

    const snapshot = await state.storage.get<Uint8Array>("ydoc:state:doc");
    expect(snapshot).toBeInstanceOf(Uint8Array);

    const restoredDoc = new Doc();
    if (!snapshot) {
      throw new Error("Expected snapshot to be defined");
    }
    applyUpdate(restoredDoc, snapshot);
    expect(restoredDoc.getMap("canvas").get("color")).toBe("green");
  });

  it("restores persisted state for new instances", async () => {
    const backing = new Map<string, unknown>();
    const env = {} as Env;

    const firstState = new MockDurableObjectState(backing);
    const firstRoom = new RoomDO(
      firstState as unknown as DurableObjectState,
      env,
    );

    const authorDoc = new Doc();
    authorDoc.getMap("notes").set("text", "hello");
    const update = encodeStateAsUpdate(authorDoc);

    await firstRoom.updateYDoc(update);
    await vi.advanceTimersByTimeAsync(ROOM_PERSIST_IDLE_MS);
    await firstState.drainWaitUntil();

    const secondState = new MockDurableObjectState(backing);
    const secondRoom = new RoomDO(
      secondState as unknown as DurableObjectState,
      env,
    );
    await Promise.resolve();
    const secondDoc = (secondRoom as unknown as { doc: Doc }).doc;

    expect(secondDoc.getMap("notes").get("text")).toBe("hello");
  });
});
