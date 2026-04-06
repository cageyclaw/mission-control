type Listener<T> = (value: T) => void;

export class TypedEventBus<EventMap extends Record<string, unknown>> {
  private listeners = new Map<keyof EventMap, Set<Listener<unknown>>>();

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    const current = this.listeners.get(event) ?? new Set<Listener<unknown>>();
    current.add(listener as Listener<unknown>);
    this.listeners.set(event, current);

    return () => this.off(event, listener);
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    const current = this.listeners.get(event);
    if (!current) return;
    current.delete(listener as Listener<unknown>);
    if (current.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit<K extends keyof EventMap>(event: K, value: EventMap[K]): void {
    const current = this.listeners.get(event);
    if (!current) return;

    for (const listener of current) {
      listener(value);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
