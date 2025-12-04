declare module 'event-emitter' {
  interface EventEmitter {
    on(event: string, listener: (...args: unknown[]) => void): this;
    off(event: string, listener: (...args: unknown[]) => void): this;
    once(event: string, listener: (...args: unknown[]) => void): this;
    emit(event: string, ...args: unknown[]): this;
  }

  function eventEmitter(obj?: object): EventEmitter;
  export = eventEmitter;
}
