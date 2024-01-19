import {ReservedKeys, World} from './world';
import {range} from 'ramda';
import {describe, expect, test} from 'vitest';
import {SystemResults, Plugins, System} from '..';
import {ReservedStages} from '@/types/world';

const createWorld = () => {
  return new World().addPlugin(Plugins.corePlugin);
};

const satisfiesInvariant = (world: World) => {
  return world instanceof World;
};

describe('Newborn world tests', () => {
  test('Default attributes', () => {
    const world = new World();
    expect(world.events).toEqual({});
    expect(world.resources).toEqual({});
    expect(world.components).toEqual({});
    expect(world.getEntities().length).toBe(0);
    expect(satisfiesInvariant(world)).true;
  });
});

describe('New Id checks', () => {
  test('Test create entities immutability', () => {
    let world = createWorld();

    world = world.setResource(ReservedKeys.ENTITY_REVIVAL_QUEUE, []);
    expect(world.createEntity()).toBe(0);
    expect(world.createEntities(5)).toEqual(range(0, 5));
    // Repeated to test immutability
    expect(world.createEntities(5)).toEqual(range(0, 5));
    expect(satisfiesInvariant(world)).true;
  });

  test('Create entities with non-empty revival queue should draw from revival queue', () => {
    let world = createWorld();
    world = world.setResource(ReservedKeys.ENTITY_REVIVAL_QUEUE, [10]);
    world.createEntities(2);
    expect(world.createEntities(2)).toEqual([10, 0]);
    expect(satisfiesInvariant(world)).true;
  });
});

describe('System Tests', () => {
  const sys1 = (world: World) => new SystemResults();
  const sys2 = (world: World) => new SystemResults();

  test('Can add systems correctly', () => {
    let world = createWorld();
    world = world.addSystem(sys1);
    world = world.addSystem(sys2, 'stage');

    const systems = world.getSystems();
    expect(systems[ReservedStages.UPDATE].size).toBe(1);
    expect(systems[ReservedStages.UPDATE].has(sys1)).toBe(true);
    expect(systems['stage'].size).toBe(1);
    expect(systems['stage'].has(sys2)).toBe(true);
    expect(satisfiesInvariant(world)).true;
  });

  test('Can add system dependencies', () => {
    const world = createWorld()
      .addSystem(sys1)
      .addSystem(sys2)
      .addSystemDependency(sys1, sys2);

    const dependencies = world.getResourceOr<Record<string, Set<string>>>(
      {},
      ReservedKeys.SYSTEM_DEPENDENCIES
    );
    expect(dependencies[sys1.name].size).toBe(1);
    expect(dependencies[sys1.name].has(sys2.name));

    const systems = world.getSystems();
    expect(systems[ReservedStages.UPDATE].size).toBe(2);
    expect(systems[ReservedStages.UPDATE].has(sys1)).toBe(true);
    expect(satisfiesInvariant(world)).true;
  });

  test('Adding system dependencies without adding the systems does nothing', () => {
    // TODO:
  });
});

describe('API Tests', () => {
  test('Add component', () => {
    let world = createWorld();
    const component = 'test';
    world = world.add(['components', component], 'hi', 1);
    const store = world.getComponentStore<string>(component);
    const ids = world.getEntities();
    expect(store.hasEntity(1), 'Entity with id of 1 is missing').toBe(true);
    expect(store.getComponent(1)).toBe('hi');
    expect(ids.includes(1)).toBe(true);
    expect(satisfiesInvariant(world)).true;
  });

  test('Add multiple components', () => {
    let world = createWorld();
    const component = 'test';
    world = world.add(['components', component], ['hi', 'there'], [0, 1]);
    const store = world.getComponentStore<string>(component);
    const ids = world.getEntities();
    expect(store.hasEntity(0), 'Entity with id of 0 is missing').toBe(true);
    expect(store.hasEntity(1), 'Entity with id of 1 is missing').toBe(true);
    expect(store.getComponent(0)).toBe('hi');
    expect(store.getComponent(1)).toBe('there');
    expect(ids.includes(0)).toBe(true);
    expect(ids.includes(1)).toBe(true);
    expect(satisfiesInvariant(world)).true;
  });

  test('Add component without ids', () => {
    let world = createWorld();
    const component = 'test';
    world = world.add(['components', component], 'hi');
    const store = world.getComponentStore<string>(component);
    const ids = world.getEntities();
    expect(store.hasEntity(0), 'Entity with id of 0 is missing').toBe(true);
    expect(store.getComponent(0)).toBe('hi');
    expect(ids.includes(0)).toBe(true);
    expect(satisfiesInvariant(world)).true;
  });

  test('Add multiple components without ids', () => {
    let world = createWorld();
    const component = 'test';
    world = world.add(['components', component], ['hi', 'there']);
    const store = world.getComponentStore<string>(component);
    const ids = world.getEntities();
    expect(store.hasEntity(0), 'Entity with id of 0 is missing').toBe(true);
    expect(store.hasEntity(1), 'Entity with id of 1 is missing').toBe(true);
    expect(store.getComponent(0)).toBe('hi');
    expect(store.getComponent(1)).toBe('there');
    expect(ids.includes(0)).toBe(true);
    expect(ids.includes(1)).toBe(true);
    expect(satisfiesInvariant(world)).true;
  });

  test('Add event', () => {
    let world = createWorld();
    const eventName = 'tick';
    world = world.add(['events', eventName], 'hi');
    const events = world.getEvents<string>(eventName);
    expect(events.length, 'Expected a single tick event').toBe(1);
    expect(events[0]).toBe('hi');
    expect(satisfiesInvariant(world)).true;
  });
});

describe('Running The Game', () => {
  test('Avoid infinite loops', () => {
    let world = createWorld();
    world = world.setResource(ReservedKeys.GAME_SHOULD_QUIT, true);
    expect(world.isFinished()).toBe(true);

    // World should exit immediately
    world.play();
    expect(1).toBe(1);
  });

  test('Can run startup stage', () => {
    let count1 = 0;
    let count2 = 0;
    let rightOrder = false;

    const sys1: System = () => {
      count1 += 1;
      return new SystemResults();
    };
    const sys2: System = () => {
      count2 += 1;
      rightOrder = count1 === 1;
      return new SystemResults();
    };

    const world = new World()
      .addSystem(sys1, ReservedStages.START_UP)
      .addSystem(sys2, ReservedStages.START_UP)
      .addSystemDependency(sys2, sys1)
      .addPlugin(w => {
        console.log(w);
        return w;
      })
      .applyStage(ReservedStages.START_UP);

    expect(satisfiesInvariant(world)).true;
    expect(count1).toBe(1);
    expect(count2).toBe(1);
    expect(rightOrder).true;
  });
});
