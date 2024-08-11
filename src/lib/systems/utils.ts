import {System} from '@/types/system';
import {World} from '../world';
import {Intention} from './intention';

/**
 * Overwrites the function name for the system.
 *
 * Useful for when naming is obscured by closures.
 */
export const nameSystem = (name: string, system: System) => {
  return Object.defineProperty(system, 'name', {value: name});
};

/**
 * A decorator for a system which specifies that the system should only be run
 * when the system has events of the supplied names. Otherwise, it returns some
 * empty system results.
 *
 * @example
 * const onTick = (system: System) => requireEvents(['tick'], system)
 *
 * let system = () => {
 *  console.log('hi')
 *  return new SystemResults();
 * }
 *
 * system = onTick(system); // now system will only run whenever a 'tick' event is detected
 */
export const requireEvents = (eventNames: string[], system: System): System => {
  const result = async (world: World) => {
    if (eventNames.some(name => world.getEvents(name).length > 0)) {
      return system(world);
    }
    return new Intention();
  };
  // Force the returned system to have the same name as the incoming one.
  return nameSystem(system.name, result);
};
