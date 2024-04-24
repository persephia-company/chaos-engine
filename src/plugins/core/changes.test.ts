import {ReservedKeys, ReservedStages, World} from '@/lib/world';
import {describe, expect, test} from 'vitest';
import {SystemResults, Plugins, System, changeEventName} from '../..';
import {logger} from '@/lib/logger';
import {logNewRawChanges} from './debug';

const createWorld = () => {
  return new World()
    .addPlugin(Plugins.corePlugin)
    .addSystem(logNewRawChanges, ReservedStages.POST_BATCH);
};

const ID = 2;
const OTHER_ID = 1;
const VALUE = 420;
const COMPONENT = 'TEST';
const OTHER_COMPONENT = 'WOOO';

const add: System = async (world: World) => {
  return new SystemResults().addComponents(COMPONENT, VALUE, ID);
};

const addOther: System = async (world: World) => {
  return new SystemResults().addComponents(OTHER_COMPONENT, VALUE, OTHER_ID);
};

const setId: System = async (world: World) => {
  return new SystemResults().setComponents(ReservedKeys.ID, ID, ID);
};

const delId: System = async (world: World) => {
  return new SystemResults().deleteComponents(ReservedKeys.ID, [], ID);
};

const delComponent: System = async (world: World) => {
  return new SystemResults().deleteComponents(COMPONENT, [], ID);
};

describe('Generation of ChangeEvents from RawChanges', () => {
  test('A simple add system creates a ChangeEvent', async () => {
    const world = await createWorld().addSystem(add).step();
    const events = world.getEvents(changeEventName('add', COMPONENT));
    expect(events.length).toBe(1);
  });

  test('A simple add system creates a corresponding id change', async () => {
    const world = await createWorld().addSystem(add).step();
    const events = world.getEvents(changeEventName('add', ReservedKeys.ID));
    expect(events.length).toBe(1);
  });

  test("Change events don't create further change events", async () => {
    const world = await createWorld().addSystem(add).step();
    const events = world.getEvents(changeEventName('add', ReservedKeys.ID));
    expect(events.length).toBe(1);

    const badName = changeEventName(
      'add',
      changeEventName('add', ReservedKeys.ID)
    );
    expect(world.getEvents(badName).length).toBe(0);
  });

  test('Setting ids only creates one changeEvent', async () => {
    const world = await createWorld().addSystem(setId).step();

    expect(
      world.getEvents(changeEventName('set', ReservedKeys.ID)).length
    ).toBe(1);

    expect(
      world.getEvents(changeEventName('add', ReservedKeys.ID)).length
    ).toBe(0);
  });

  test('Deleting a component should not delete the corresponding id', async () => {
    let world = await createWorld()
      .addSystem(add, ReservedStages.START_UP)
      .addSystem(delComponent)
      .applyStage(ReservedStages.START_UP);

    world = await world.step();

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
    let world = await createWorld()
      .addSystem(setId, ReservedStages.START_UP)
      .addSystem(delId)
      .applyStage(ReservedStages.START_UP);

    world = await world.step();

    // Should delete ID
    expect(world.getComponentStore(ReservedKeys.ID).hasEntity(ID)).false;
    expect(world.getComponentStore(ReservedKeys.ID).length()).toBe(0);
  });

  test('Deleting an id should delete related components and create events.', async () => {
    let world = await createWorld()
      .addSystem(add, ReservedStages.START_UP)
      .addSystem(delId)
      // Add Dummy system to see effects of terminating the entity in a previous post-batch
      .addSystem(async () => {}, ReservedStages.POST_STEP)
      .applyStage(ReservedStages.START_UP);

    world = await world.step();

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
    let world = await createWorld()
      .addSystem(add, ReservedStages.START_UP)
      .addSystem(addOther, ReservedStages.START_UP)
      .addSystem(delId)
      .applyStage(ReservedStages.START_UP);

    world = await world.step();

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
    const world = await createWorld().addSystem(add).step();
    const events = world.getEvents(changeEventName('modified', COMPONENT));
    expect(events.length).toBe(1);
  });
});

// BUG: Failing but might require an overhaul of how systems are processed by the world.
describe('Test generation of CreatedChanges from ChangeEvents', () => {
  test('A simple add system creates a CreatedChange', async () => {
    const world = await createWorld().addSystem(add).step();
    const events = world.getEvents(changeEventName('created', COMPONENT));
    expect(events.length).toBe(1);
  });
});
