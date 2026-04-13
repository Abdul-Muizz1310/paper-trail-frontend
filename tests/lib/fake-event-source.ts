/**
 * Minimal EventSource stand-in for tests.
 *
 * Install on `globalThis.EventSource` inside a test, drive events with
 * `instance.emit(name, data)` / `instance.fail()` / `instance.openNow()`.
 */

type Listener = (ev: MessageEvent | Event) => void;

export class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static last(): FakeEventSource {
    const i = FakeEventSource.instances.at(-1);
    if (!i) throw new Error("No FakeEventSource has been constructed");
    return i;
  }
  static reset(): void {
    FakeEventSource.instances = [];
  }

  readonly url: string;
  readyState = 0; // 0 CONNECTING, 1 OPEN, 2 CLOSED
  onopen: Listener | null = null;
  onerror: Listener | null = null;
  onmessage: Listener | null = null;
  /* @internal — exposed for test-only direct access */
  readonly _listeners = new Map<string, Set<Listener>>();

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
    // Do not auto-open — tests control timing via `openNow()`.
  }

  addEventListener(type: string, listener: Listener): void {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this._listeners.get(type)?.delete(listener);
  }

  close(): void {
    this.readyState = 2;
  }

  // ---- test-only drivers ----

  openNow(): void {
    this.readyState = 1;
    const ev = new Event("open");
    this.onopen?.(ev);
    this._listeners.get("open")?.forEach((l) => {
      l(ev);
    });
  }

  emit(name: string, data: unknown): void {
    const ev = new MessageEvent(name, {
      data: typeof data === "string" ? data : JSON.stringify(data),
    });
    this._listeners.get(name)?.forEach((l) => {
      l(ev);
    });
    if (name === "message") this.onmessage?.(ev);
  }

  fail(): void {
    this.readyState = 2;
    const ev = new Event("error");
    this.onerror?.(ev);
    this._listeners.get("error")?.forEach((l) => {
      l(ev);
    });
  }
}
