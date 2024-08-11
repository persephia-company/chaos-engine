import {ReservedKeys, ReservedStages, World} from '@/lib/world';
import {describe, expect, test} from 'vitest';
import {Intention, Plugins, System, changeEventName} from '../..';
import {logger} from '@/lib/logger';
import {logNewRawChanges} from './debug';
import {fixedID} from '@/lib/entity';

const createWorld = () => {
  return new World()
    .addPlugin(Plugins.corePlugin)
    .addSystem(logNewRawChanges, ReservedStages.POST_BATCH);
};

const createWorldWithSystems = (...systems: System[]) => {
  let world = createWorld();

  for (const system of systems) {
    world = world.addSystem(system);
  }

  world.applyStage(ReservedStages.START_UP);
  return world;
};

const ID = 2;
const OTHER_ID = 1;
const VALUE = 420;
const COMPONENT = 'TEST';
const OTHER_COMPONENT = 'WOOO';

const add: System = async (world: World) => {
  return new Intention().addComponent(COMPONENT, VALUE, fixedID(ID));
};

const addOther: System = async (world: World) => {
  return new Intention().addComponent(
    OTHER_COMPONENT,
    VALUE,
    fixedID(OTHER_ID)
  );
};

const setId: System = async (world: World) => {
  return new Intention().setComponent(ReservedKeys.ID, ID, fixedID(ID));
};

const delId: System = async (world: World) => {
  return new Intention().deleteComponent(ReservedKeys.ID, fixedID(ID));
};

const delComponent: System = async (world: World) => {
  return new Intention().deleteComponent(COMPONENT, fixedID(ID));
};

describe('Generation of ChangeEvents from RawChanges', () => {
  test('A simple add system creates a ChangeEvent', async () => {
    const world = createWorldWithSystems(add);
    await world.step();

    const events = world.getEvents(changeEventName('add', COMPONENT));
    expect(events.length).toBe(1);
  });

  test('A simple add system creates a corresponding id change', async () => {
    const world = createWorldWithSystems(add);
    await world.step();
    const events = world.getEvents(changeEventName('add', ReservedKeys.ID));
    expect(events.length).toBe(1);
  });

  test("Change events don't create further change events", async () => {
    const world = createWorldWithSystems(add);
    await world.step();
    const events = world.getEvents(changeEventName('add', ReservedKeys.ID));
    expect(events.length).toBe(1);

    const badName = changeEventName(
      'add',
      changeEventName('add', ReservedKeys.ID)
    );
    expect(world.getEvents(badName).length).toBe(0);
  });

  test('Setting ids only creates one changeEvent', async () => {
    const world = createWorldWithSystems(setId);
    await world.step();

    expect(
      world.getEvents(changeEventName('set', ReservedKeys.ID)).length
    ).toBe(1);

    expect(
      world.getEvents(changeEventName('add', ReservedKeys.ID)).length
    ).toBe(0);
  });

  test('Deleting a component should not delete the corresponding id', async () => {
    const world = createWorld()
      .addSystem(add, ReservedStages.START_UP)
      .addSystem(delComponent);

    await world.applyStage(ReservedStages.START_UP);
    await world.step();

    expect(world.getComponentStore(COMPONENT).hasEntity(ID)).false;
    expect(world.getComponentStore(ReservedKeys.ID).hasEntity(ID)).true;

    expect(world.getEvents(changeEventName('delete', COMPONENT)).length).toBe(
      1
    );

    expect(
      world.getEvents(changeEventName('delete', ReservedKeys.ID)).length
    ).toBe(0);
  });

  test('Deleting an id component should delete that id', async () => {
    const world = createWorld()
      .addSystem(setId, ReservedStages.START_UP)
      .addSystem(delId);

    await world.applyStage(ReservedStages.START_UP);
    await world.step();

    // Should delete ID
    expect(world.getComponentStore(ReservedKeys.ID).hasEntity(ID)).false;
    expect(world.getComponentStore(ReservedKeys.ID).length()).toBe(0);
  });

  test('Deleting an id should delete related components and create events.', async () => {
    const world = createWorld()
      .addSystem(add, ReservedStages.START_UP)
      .addSystem(delId)
      // Add Dummy system to see effects of terminating the entity in a previous post-batch
      .addSystem(async () => {}, ReservedStages.POST_STEP);

    await world.applyStage(ReservedStages.START_UP);
    await world.step();

    // Should delete ID
    expect(world.getComponentStore(ReservedKeys.ID).hasEntity(ID)).false;
    expect(world.getComponentStore(ReservedKeys.ID).length()).toBe(0);
    expect(
      world.getEvents(changeEventName('delete', ReservedKeys.ID)).length
    ).toBe(1);

    // Should also delete the component it had
    expect(world.getComponentStore(COMPONENT).hasEntity(ID)).false;
    expect(world.getComponentStore(COMPONENT).length()).toBe(0);
    expect(world.getEvents(changeEventName('delete', COMPONENT)).length).toBe(
      1
    );
  });

  test('Deleting an id should not create deletion change events for unowned components', async () => {
    const world = createWorldWithSystems()
      .addSystem(add, ReservedStages.START_UP)
      .addSystem(addOther, ReservedStages.START_UP)
      .addSystem(delId);

    await world.applyStage(ReservedStages.START_UP);
    await world.step();

    // Should delete ID
    expect(
      world.getEvents(changeEventName('delete', ReservedKeys.ID)).length
    ).toBe(1);

    expect(
      world.getEvents(changeEventName('delete', OTHER_COMPONENT)).length
    ).toBe(0);
  });
});

describe('Test generation of ModifiedChanges from ChangeEvents', () => {
  test('A simple add system creates a CreatedChange', async () => {
    const world = createWorldWithSystems().addSystem(add);
    await world.step();
    const events = world.getEvents(changeEventName('modified', COMPONENT));
    expect(events.length).toBe(1);
  });
});
