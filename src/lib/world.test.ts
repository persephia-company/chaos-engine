import {ReservedKeys, World} from './world';
import {range} from 'ramda';
import {describe, expect, test} from 'vitest';
import {Intention, Plugins, System, logger} from '..';
import {ReservedStages} from '@/lib/world';
import {realID} from './entity';

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

    world = world.setResource(ReservedKeys.ENTITY_REVIVAL_STACK, []);
    expect(world.createEntity()).toBe(0);
    expect(world.createEntities(5)).toEqual(range(0, 5));
    // Repeated to test immutability
    expect(world.createEntities(5)).toEqual(range(0, 5));
    expect(satisfiesInvariant(world)).true;
  });

  test('Create entities with non-empty revival queue should draw from revival queue', () => {
    let world = createWorld();
    world = world.setResource(ReservedKeys.ENTITY_REVIVAL_STACK, [10]);
    world.createEntities(2);
    expect(world.createEntities(2)).toEqual([10, 0]);
    expect(satisfiesInvariant(world)).true;
  });
});

describe('System Tests', () => {
  const sys1 = async (world: World) => new Intention();
  const sys2 = async (world: World) => new Intention();

  const addComponentWithFixedId = () =>
    new Intention().addComponent('test', 1, realID(10));

  const addComponentWithoutId = () => new Intention().addComponent('test', 2);

  const addComponentWithUnbornId = () => {
    const intention = new Intention();
    const id = intention.createID();
    return intention.addComponent('test', 3, id);
  };

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

  test('Applying intentions should reflect their changes in the world.', async () => {
    const world = createWorld().applyIntention(addComponentWithFixedId());
    const store = world.components['test'];
    const idStore = world.components[ReservedKeys.ID];
    expect(store.length()).toBe(1);
    expect(store.hasEntity(10)).true;
    expect(idStore.hasEntity(10)).true;
  });

  test('Intention AddComponentChanges without ids should create new ids in the world.', async () => {
    const world = createWorld().applyIntention(addComponentWithoutId());
    const store = world.components['test'];
    const idStore = world.components[ReservedKeys.ID];
    expect(store.length()).toBe(1);
    expect(store.hasEntity(0)).true;
    expect(store.getComponent(0)).toBe(2);
    expect(idStore.hasEntity(0)).true;
  });

  test('Unborn ids from intention should be created when intentions are applied.', async () => {
    const world = createWorld().applyIntention(addComponentWithUnbornId());
    const store = world.components['test'];
    const idStore = world.components[ReservedKeys.ID];
    expect(store.length()).toBe(1);
    expect(store.hasEntity(0)).true;
    expect(store.getComponent(0)).toBe(3);
    expect(idStore.hasEntity(0)).true;
  });

  test("Missing ids shouldn't conflict with unborn ids", async () => {
    const unbornIntention = addComponentWithUnbornId();
    const intention = unbornIntention.merge(addComponentWithoutId());
    const world = createWorld().applyIntention(intention);
    const store = world.components['test'];
    const idStore = world.components[ReservedKeys.ID];
    expect(store.length()).toBe(2);
    expect(store.hasEntity(0)).true;
    expect(store.hasEntity(1)).true;
    expect(store.getComponent(0)).toBe(3);
    expect(store.getComponent(1)).toBe(2);
    expect(idStore.hasEntity(0)).true;
  });
});

describe('API Tests', () => {
  test('Add component', () => {
    let world = createWorld();
    const component = 'test';
    world = world.applyChange({
      method: 'add',
      path: ['components', component],
      value: 'hi',
      id: 1,
    });
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

    world = world.applyChange({
      method: 'add',
      path: ['components', component],
      value: 'hi',
      id: 0,
    });

    world = world.applyChange({
      method: 'add',
      path: ['components', component],
      value: 'there',
      id: 1,
    });
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
    world = world.applyChange({
      method: 'add',
      path: ['events', eventName],
      value: 'hi',
    });
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

  test('Can run startup stage', async () => {
    let count1 = 0;
    let count2 = 0;
    let rightOrder = false;

    const sys1: System = async () => {
      count1 += 1;
      return new Intention();
    };
    const sys2: System = async () => {
      count2 += 1;
      rightOrder = count1 === 1;
      return new Intention();
    };

    const world = new World()
      .addSystem(sys1, ReservedStages.START_UP)
      .addSystem(sys2, ReservedStages.START_UP)
      .addSystemDependency(sys2, sys1);

    await world.applyStage(ReservedStages.START_UP);

    expect(satisfiesInvariant(world)).true;
    expect(count1).toBe(1);
    expect(count2).toBe(1);
    expect(rightOrder).true;
  });

  test('Resources specified by system should be available to future systems', async () => {
    const setRes: System = async () => {
      return new Intention().setResource('X', 1);
    };
    const otherSystem: System = async world => {
      expect(world.getResource('X')).toBe(1);
    };

    const world = new World()
      .addSystem(setRes, ReservedStages.START_UP)
      .addSystem(otherSystem, ReservedStages.START_UP)
      .addSystemDependency(otherSystem, setRes);

    await world.applyStage(ReservedStages.START_UP);

    expect(world.getResource('X')).toBe(1);
  });
});
