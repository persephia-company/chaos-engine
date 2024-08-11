import {Intention, nameSystem} from '@/lib/systems';
import {System} from '@/types/system';
import {Timer} from './timer';

export const createTimerSystemForComponent = (
  componentName: string,
  systemName: string
): System => {
  const system: System = async world => {
    const timers = world
      .query<[Timer<unknown>]>([componentName])
      .map(group => group[0]);

    const poppedTimers = timers.filter(timer => timer.emitCount() > 0);

    // Build up all the timer event lists to propagate.
    const events = poppedTimers.reduce(
      (events, timer) => {
        if (!Object.keys(events).includes(timer.event)) {
          events[timer.event] = [];
        }

        for (let i = 0; i < timer.emitCount(); i++) {
          events[timer.event].push(timer.payload);
        }
        return events;
      },
      {} as Record<string, unknown[]>
    );

    let results = new Intention();
    Object.entries(events).forEach(([eventName, payloads]) => {
      results = results.addEvents(eventName, payloads);
    });

    // Accumulate time on all timers
    const timerTicks = new Intention().updateComponents<Timer<unknown>>(
      componentName,
      timer => timer.tick()
    );
    return results.merge(timerTicks);
  };

  return nameSystem(systemName, system);
};

export const createTimerSystemForResource = <T>(
  resourceName: string,
  systemName: string
): System => {
  const system: System = async world => {
    const timer = world.getResource<Timer<T>>(resourceName);
    if (timer === undefined) return;

    const intention = new Intention().updateResource<Timer<T>>(
      resourceName,
      timer => timer.tick()
    );

    // Check to see if it has popped
    const emitCount = timer.emitCount();
    if (emitCount === 0) return intention;

    // Return the timer update changes and the emitted events.
    const payloads: (T | undefined)[] = [];
    for (let i = 0; i < emitCount; i++) {
      payloads.push(timer.payload);
    }
    return intention.addEvents(timer.event, payloads);
  };

  return nameSystem(systemName, system);
};
