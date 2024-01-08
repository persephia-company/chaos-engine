import {SystemResults, defsys} from '@/lib/system';
import {first} from '@/lib/util';
import {range, repeat} from 'ramda';

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

export const createTimerSystem = (componentName: string) =>
  defsys<[Timer<unknown>]>({components: [componentName]}, ({components}) => {
    const timers = components.map(first) as Timer<unknown>[];
    const poppedTimers = timers.filter(timer => timer.emitCount() > 0);

    // Capture all emitted events
    const events: Record<string, unknown[]> = {};
    poppedTimers.forEach(timer => {
      range(0, timer.emitCount()).forEach(() => {
        if (!Object.keys(events).includes(timer.event)) {
          events[timer.event] = [];
        }
        events[timer.event].push(timer.payload);
      });
    });

    let results = new SystemResults();
    Object.entries(events).forEach(([event, payloads]) => {
      results = results.add(['events', event], payloads);
    });

    // Accumulate time on all timers
    const timerTicks = new SystemResults().update<Timer<unknown>>(
      ['components', componentName],
      timer => timer.tick()
    );
    return results.merge(timerTicks);
  });

export const createTimerResourceSystem = (resourceName: string) =>
  defsys({resources: [resourceName]}, ({resources}) => {
    const timer = resources[resourceName] as Timer<unknown> | undefined;
    if (!timer) return new SystemResults();

    const timerTicks = new SystemResults().update<Timer<unknown>>(
      ['resources', resourceName],
      timer => timer.tick()
    );

    // Check to see if it has popped
    const emitCount = timer.emitCount();
    if (emitCount === 0) return timerTicks;

    // Return the timer update changes and the emitted events.
    const payloads = repeat(timer.payload, emitCount);
    const results = new SystemResults().add(['events', timer.event], payloads);
    return results.merge(timerTicks);
  });
