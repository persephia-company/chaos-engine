export class Timer<T> {
  /** The number of ms required to accumulate before the timer will emit its event */
  ms: number;
  event: string;
  /** How much time has accumulated so far. */
  acc: number;
  lastTime: number;
  payload?: T;
  shouldLoop: boolean;
  freeze: boolean;

  constructor(
    ms: number,
    event: string,
    acc = 0,
    lastTime = Date.now(),
    payload?: T,
    shouldLoop = false,
    freeze = false
  ) {
    this.ms = ms;
    this.lastTime = lastTime;
    this.acc = acc;
    this.event = event;
    this.payload = payload;
    this.shouldLoop = shouldLoop;
    this.freeze = freeze;
  }

  update(updates: Partial<Timer<T>>): Timer<T> {
    const {ms, lastTime, acc, event, payload, shouldLoop, freeze} = {
      ...this,
      ...updates,
    };
    return new Timer<T>(ms, event, acc, lastTime, payload, shouldLoop, freeze);
  }

  private delta(): number {
    return Math.abs(Date.now() - this.lastTime);
  }

  emitCount(): number {
    return Math.floor((this.acc + this.delta()) / this.ms);
  }

  tick() {
    const acc = (this.delta() + this.acc) % this.ms;
    return this.update({acc, lastTime: Date.now()});
  }
}
