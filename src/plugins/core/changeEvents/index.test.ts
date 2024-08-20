import {ReservedKeys, ReservedStages, World} from '@/lib/world';
import {describe, expect, test} from 'vitest';
import {Intention, Plugins, System, changeEventName, logger} from '@/index';
import {logNewRawChanges} from './systems/debug';
import {realID} from '@/lib/entity';
import {resetEvents} from '..';

const dontResetIDs: System = async world => {
  return new Intention().updateResource<Record<string, Set<System>>>(
    ReservedKeys.SYSTEMS,
    systems => {
      (systems[ReservedStages.POST_STEP] ?? new Set()).delete(resetEvents);
      return systems;
    }
  );
};

const createWorld = () => {
  return new World()
    .addPlugin(Plugins.corePlugin)
    .addSystem(logNewRawChanges, ReservedStages.POST_BATCH)
    .addSystem(dontResetIDs, ReservedStages.START_UP)
    .deleteSystem(resetEvents, ReservedStages.POST_STEP);
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
const VALUE = 420;
const COMPONENT = 'TEST';

const add: System = async (world: World) => {
  return new Intention().addComponent(COMPONENT, VALUE, realID(ID));
};

const setId: System = async (world: World) => {
  return new Intention().setComponent(ReservedKeys.ID, ID, realID(ID));
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
});

describe('Test generation of ModifiedChanges from ChangeEvents', () => {
  test('A simple add system creates a CreatedChange', async () => {
    const world = createWorldWithSystems(add);
    await world.step();
    const events = world.getEvents(changeEventName('modified', COMPONENT));
    expect(events.length).toBe(1);
  });
});
