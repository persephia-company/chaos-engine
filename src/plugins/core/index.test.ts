import {World} from '@/lib/world';
import {ReservedStages} from '@/lib/keys';
import {describe, expect, test} from 'vitest';
import {Intention, Plugins, System} from '../..';

const satisfiesInvariant = (world: World) => {
  return world instanceof World;
};

describe('Core plugins', () => {
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
      .addPlugin(Plugins.corePlugin)
      .addSystem(sys1, ReservedStages.START_UP)
      .addSystem(sys2, ReservedStages.START_UP)
      .addSystemDependency(sys2, sys1);

    await world.applyStage(ReservedStages.START_UP);

    expect(satisfiesInvariant(world)).true;
    expect(count1).toBe(1);
    expect(count2).toBe(1);
    expect(rightOrder).true;
  });
});
