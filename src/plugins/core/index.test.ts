import {ReservedKeys, World} from '@/lib/world';
import {describe, expect, test} from 'vitest';
import {SystemResults, Plugins, System} from '../..';
import {ReservedStages} from '@/types/world';
import {debugPlugin} from '.';

const createWorld = () => {
  return new World().addPlugin(Plugins.corePlugin);
};

const satisfiesInvariant = (world: World) => {
  return world instanceof World;
};

describe('Core plugins', () => {
  test('Can run startup stage', () => {
    const data: Record<string, any> = {};
    const sys1: System = () => {
      data['run1'] = true;
      return new SystemResults();
    };
    const sys2: System = () => {
      data['run2'] = true;
      data['rightOrder'] = data['run1'] ?? false;
      return new SystemResults();
    };

    const world = createWorld()
      .addSystem(sys1, ReservedStages.START_UP)
      .addSystem(sys2, ReservedStages.START_UP)
      .addSystemDependency(sys2, sys1)
      .addPlugin(debugPlugin)
      .applyStage(ReservedStages.START_UP);

    expect(satisfiesInvariant(world)).true;
    expect(data['run1']).true;
    expect(data['run2']).true;
    expect(data['rightOrder']).true;
  });
});
