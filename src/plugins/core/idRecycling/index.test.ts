import {ReservedKeys, ReservedStages, World} from '@/lib/world';
import {describe, expect, test} from 'vitest';
import {
  DeleteComponentChange,
  EntityID,
  Intention,
  Plugins,
  System,
  changeEventName,
  getStageBatchNames,
  getSystemNames,
} from '@/index';
import {realID} from '@/lib/entity';
import {logNewRawChanges} from '../changeEvents/systems/debug';
import {resetEvents} from '..';
import {getCreatedIds} from './lib';

const createWorld = () => {
  return new World()
    .addPlugin(Plugins.corePlugin)
    .addSystem(logNewRawChanges, ReservedStages.POST_BATCH);
  //.deleteSystem(resetEvents, ReservedStages.POST_STEP);
};

const COMPONENT = 'TEST';
const ID = 2;
const OTHER_ID = 1;
const VALUE = 420;
const OTHER_COMPONENT = 'WOOO';

const dummySystem: System = async () => {};

const addWithoutID: System = async (world: World) => {
  return new Intention().addComponent(COMPONENT, 1);
};

const setComponentWithRealID: System = async (world: World) => {
  return new Intention().setComponent(COMPONENT, 1, realID(1));
};

const del: System = async (world: World) => {
  return new Intention().deleteComponents(ReservedKeys.ID, [0, 1].map(realID));
};

const add: System = async (world: World) => {
  return new Intention().addComponent(COMPONENT, VALUE, realID(ID));
};

const addOther: System = async (world: World) => {
  return new Intention().addComponent(OTHER_COMPONENT, VALUE, realID(OTHER_ID));
};

const setId: System = async (world: World) => {
  return new Intention().setComponent(ReservedKeys.ID, ID, realID(ID));
};

const delId: System = async (world: World) => {
  return new Intention().deleteComponent(ReservedKeys.ID, realID(ID));
};

const deleteAllIds: System = async (world: World) => {
  return new Intention().deleteAllComponentsOfName(ReservedKeys.ID);
};

const delComponent: System = async (world: World) => {
  return new Intention().deleteComponent(COMPONENT, realID(ID));
};

const createWorldWithSystems = (...systems: System[]) => {
  let world = createWorld();

  for (const system of systems) {
    world = world.addSystem(system);
  }

  world.applyStage(ReservedStages.START_UP);
  return world;
};

describe('Test id related plugins', () => {
  test('Adding an entity increases the max entity id', async () => {
    const world = createWorld().addSystem(addWithoutID);
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(-1);

    await world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(0);

    await world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);
  });

  test('Adding a component to an existing entity leaves the max id the same', async () => {
    const world = createWorld().addSystem(setComponentWithRealID);
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(-1);

    await world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);

    await world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);
  });

  test('Deleting an entity id component should trigger appropriate deletion events', async () => {
    const world = createWorld()
      .addSystem(add)
      .addSystem(delId)
      .addSystemDependency(delId, add)
      .deleteSystem(resetEvents, ReservedStages.POST_STEP);

    await world.step();

    const idDeletionEvents = world.getEvents<DeleteComponentChange<EntityID>>(
      changeEventName('delete', ReservedKeys.ID)
    );

    const componentDeletionEvents = world.getEvents<
      DeleteComponentChange<EntityID>
    >(changeEventName('delete', COMPONENT));

    expect(idDeletionEvents.length).toBe(1);
    expect(componentDeletionEvents.length).toBe(1);
  });

  test('Deleting all entity id components should trigger appropriate deletion events', async () => {
    const world = createWorld()
      .addSystem(add)
      .addSystem(deleteAllIds)
      .addSystemDependency(deleteAllIds, add)
      .deleteSystem(resetEvents, ReservedStages.POST_STEP);

    await world.step();
    const idDeletionEvents = world.getEvents<DeleteComponentChange<EntityID>>(
      changeEventName('delete', ReservedKeys.ID)
    );

    const componentDeletionEvents = world.getEvents<
      DeleteComponentChange<EntityID>
    >(changeEventName('delete', COMPONENT));

    expect(idDeletionEvents.length).toBe(1);
    expect(componentDeletionEvents.length).toBe(1);
  });

  test('Deleting the entity id component should remove it from all components', async () => {
    let world = createWorld().addSystem(setComponentWithRealID);
    await world.step();

    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);
    expect(world.getComponentStore(COMPONENT).getComponent(1)).toBe(1);

    world = world
      .addSystem(del)
      .addSystemDependency(del, setComponentWithRealID);
    await world.step();
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(1);
    const componentStore = world.getComponentStore<number>(COMPONENT);
    expect(componentStore.getComponent(1)).toBe(undefined);
  });

  test('Deleting the entity id component should place it on the revival queue', async () => {
    let world = createWorld().addSystem(addWithoutID);

    await world.stepN(3);
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(2);

    world = world.addSystem(del, ReservedStages.PRE_STEP);
    await world.applyStage(ReservedStages.PRE_STEP);

    const revivalQueue = world.getResourceOr(
      new Set(),
      ReservedKeys.ENTITY_REVIVAL_STACK
    );

    expect(revivalQueue.size).toBe(2);
    expect(revivalQueue.has(0)).true;
    expect(revivalQueue.has(1)).true;
  });

  test('New ids are taken first from the revival queue', async () => {
    let world = createWorld().addSystem(addWithoutID);

    await world.stepN(3);

    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(2);
    world = world.addSystem(del).addSystemDependency(addWithoutID, del);

    await world.step();

    const revivalQueue = world.getResourceOr(
      new Set(),
      ReservedKeys.ENTITY_REVIVAL_STACK
    );
    expect(revivalQueue.size).toBe(1);

    // Shouldn't incrememnt maxID
    expect(world.getResourceOr(-1, ReservedKeys.MAX_ID)).toBe(2);
  });

  test('Deleting a component should not delete the corresponding id', async () => {
    const world = createWorld()
      .addSystem(add, ReservedStages.START_UP)
      .addSystem(delComponent)
      .deleteSystem(resetEvents, ReservedStages.POST_STEP);

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

  test('Deleting an id should delete the related components', async () => {
    const world = createWorld()
      .addSystem(add, ReservedStages.START_UP)
      .addSystem(delId)
      // Add Dummy system to see effects of terminating the entity in a previous post-batch
      .addSystem(async () => {}, ReservedStages.POST_STEP);

    await world.applyStage(ReservedStages.START_UP);
    await world.step();

    // Should delete ID
    const idStore = world.getComponentStore(ReservedKeys.ID);
    expect(idStore.hasEntity(ID)).false;
    expect(idStore.length()).toBe(0);

    // Should also delete the component it had
    expect(world.getComponentStore(COMPONENT).hasEntity(ID)).false;
    expect(world.getComponentStore(COMPONENT).length()).toBe(0);
  });

  test('Deleting an id should not create deletion change events for unowned components', async () => {
    const world = createWorldWithSystems()
      .addSystem(add, ReservedStages.START_UP)
      .addSystem(addOther, ReservedStages.START_UP)
      .addSystem(delId);

    await world.applyStage(ReservedStages.START_UP);

    let idStore = world.getComponentStore(ReservedKeys.ID);

    expect(idStore.hasEntity(ID)).true;
    expect(idStore.hasEntity(OTHER_ID)).true;

    let componentStore = world.getComponentStore(COMPONENT);
    expect(componentStore.length()).toBe(1);
    expect(componentStore.hasEntity(OTHER_ID)).false;
    expect(componentStore.hasEntity(ID)).true;

    let otherComponentStore = world.getComponentStore(OTHER_COMPONENT);
    expect(otherComponentStore.length()).toBe(1);
    expect(otherComponentStore.hasEntity(OTHER_ID)).true;
    expect(otherComponentStore.hasEntity(ID)).false;

    await world.step();

    // Should delete ID
    idStore = world.getComponentStore(ReservedKeys.ID);
    expect(idStore.hasEntity(ID)).false;
    expect(idStore.hasEntity(OTHER_ID)).true;
    expect(idStore.length()).toBe(1);

    componentStore = world.getComponentStore(COMPONENT);
    expect(componentStore.length()).toBe(0);
    expect(componentStore.hasEntity(OTHER_ID)).false;
    expect(componentStore.hasEntity(ID)).false;

    otherComponentStore = world.getComponentStore(OTHER_COMPONENT);
    expect(otherComponentStore.length()).toBe(1);
    expect(otherComponentStore.hasEntity(OTHER_ID)).true;
    expect(otherComponentStore.hasEntity(ID)).false;
  });
});
