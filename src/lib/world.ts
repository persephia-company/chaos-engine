import {Entity} from '@/types/entity';
import {ComponentStore} from '@/types/store';
import {System, SystemResults} from '@/types/system';
import {World, ReservedStages} from '@/types/world';
import * as R from 'ramda';
import {DepGraph} from 'dependency-graph';
import stringify from 'json-stable-stringify';
import {groupBy, hash_cyrb53} from './util';
import {Queue} from '@datastructures-js/queue';

enum ReservedKeys {
  GAME_SHOULD_QUIT = 'game-should-quit',
  SYSTEMS = 'systems',
  SYSTEM_DEPENDENCIES = 'system-dependencies',
  SYSTEM_DEPENDENCY_GRAPH = 'system-dependency-graph',
  SYSTEM_DEPENDENCY_HASH = 'system-dependency-hash',
  SYSTEM_BATCHES = 'system-batches',
  STAGE_DEPENDENCIES = 'stage-dependencies',
}

/**
 * Returns all entities within the world.
 */
export const getEntities = (world: World): Entity[] => [];

/**
 * Returns an id that would represent a new entity within the world.
 */
export const createEntity = (world: World): Entity => 1;

export const setResource = R.curry(<T>(key: string, value: T, world: World) => {
  return R.assocPath(['resources', key], value, world);
});

export const getResourceOr = R.curry(
  <T>(otherwise: T | undefined, key: string, world: World): T | undefined => {
    return R.pathOr(otherwise, ['resources', key], world);
  }
);

export const getResource = getResourceOr(undefined);

export const getEvents = <T>(key: string, world: World): T[] => {
  return R.pathOr([], ['events', key], world);
};

/**
 * Returns a map of stages to their included systems within the world
 */
export const getSystems: (world: World) => Record<string, Set<System>> =
  getResourceOr({} as Record<string, Set<System>>, ReservedKeys.SYSTEMS);

/**
 * Returns a map of systems to their dependencies
 */
export const getSystemDependencies: (
  world: World
) => Record<string, Set<string>> = getResourceOr(
  {} as Record<string, Set<string>>,
  ReservedKeys.SYSTEM_DEPENDENCIES
);

/**
 * Adds a new System to the world.
 */
export const addSystem = (
  world: World,
  system: System,
  stage: string = ReservedStages.UPDATE
) => {
  const systems = getSystems(world);
  const stageSystems: Set<System> = R.propOr(new Set<System>(), stage, systems);
  stageSystems.add(system);

  const updateSystems = R.assocPath(['resources', ReservedKeys.SYSTEMS]);
  return updateSystems(R.assoc(stage, stageSystems, systems), world);
};

export const addSystemDependency = (
  world: World,
  system: System,
  dependency: System
): World => {
  const dependencies = getSystemDependencies(world);
  const systemDependencies: Set<string> = R.propOr(
    new Set<string>(),
    system.name,
    dependencies
  );
  systemDependencies.add(dependency.name);

  const updateDependencies = R.assocPath([
    'resources',
    ReservedKeys.SYSTEM_DEPENDENCIES,
  ]);
  return updateDependencies(
    R.assoc(system.name, systemDependencies, dependencies),
    world
  );
};

export const addStageDependency = (
  world: World,
  stage: string,
  dependency: string
): World => {
  const dependencies = getSystemDependencies(world);
  const stageDependencies: Set<string> = R.propOr(
    new Set<string>(),
    stage,
    dependencies
  );
  stageDependencies.add(dependency);

  const updateDependencies = R.assocPath([
    'resources',
    ReservedKeys.STAGE_DEPENDENCIES,
  ]);
  return updateDependencies(
    R.assoc(stage, stageDependencies, dependencies),
    world
  );
};

/**
 * Queries the world for all supplied components
 */
export const query = <T extends any[]>(
  world: World,
  components: string[]
): T[] => {
  const componentStores = components
    .map(component => world.components[component])
    .filter(store => store !== undefined);

  if (componentStores.length !== components.length || components.length === 0) {
    return [];
  }

  const sortedStores = R.sortBy(x => x.length(), componentStores);
  // Get ids from smallest store
  const ids = sortedStores[0].getItems().map(([id, _]) => id);
  const otherStores = R.drop(1, sortedStores);

  const intersectingIds = (ids: number[], store: ComponentStore<unknown>) => {
    return ids.filter(id => store.hasEntity(id));
  };
  const sharedIds = R.reduce(intersectingIds, ids, otherStores);

  const buildTuple = (id: number) =>
    R.map(store => store.getComponent(id), componentStores);

  return R.map(buildTuple, sharedIds) as T[];
};

const buildDependencyGraph = (
  nodes: string[],
  dependencies: Record<string, Set<string>>
): DepGraph<string> => {
  const result = new DepGraph<string>();
  nodes.forEach(node => result.addNode(node));

  Object.entries(dependencies).forEach(([node, deps]) => {
    deps.forEach(dependency => result.addDependency(node, dependency));
  });

  return result;
};

const rebuildSystemDependencyGraph = (world: World): World => {
  const systems = Object.values(getSystems(world))
    .flatMap(s => Array.from(s.values()))
    .map(system => system.name);

  const dependencies = getSystemDependencies(world);
  const graph = buildDependencyGraph(systems, dependencies);

  return setResource(ReservedKeys.SYSTEM_DEPENDENCY_GRAPH, graph, world);
};

const hashSystems = (world: World): number => {
  const systems = Object.values(getSystems(world))
    .flatMap(s => Array.from(s.values()))
    .map(system => system.name);

  const rawDependencies = getSystemDependencies(world);
  const dependencies = Object.fromEntries(
    Object.entries(rawDependencies).map(([node, deps]) => [
      node,
      Array.from(deps.values()),
    ])
  );
  return hash_cyrb53(stringify({systems, dependencies}));
};

const isSystemGraphCurrent = (world: World): boolean => {
  return (
    getResource(ReservedKeys.SYSTEM_DEPENDENCY_HASH, world) ===
    hashSystems(world)
  );
};

const buildStageBatches = (world: World): World => {
  const systems = getSystems(world);
  const graph = getResource(
    ReservedKeys.SYSTEM_DEPENDENCY_GRAPH,
    world
  ) as DepGraph<string>;

  const buildStageBatch = (stage: string): System[][] => {
    const stageSystems = Array.from((systems[stage] ?? new Set()).values());
    const depths = findDepths(stageSystems, graph);
    const systemsByDepth = groupBy(a => a[1], Object.entries(depths));

    const x = R.sortBy(
      ([depth, _]) => Number.parseInt(depth),
      Object.entries(systemsByDepth)
    );

    const result: System[][] = [];
    x.forEach(([_, group]) => {
      const systems: System[] = [];
      group.forEach(([name, _]) => {
        const system = stageSystems.find(system => system.name === name);
        if (system) {
          systems.push(system);
        }
      });
      result.push(systems);
    });
    return result;
  };

  const addStageBatch = (result: Record<string, System[][]>, stage: string) =>
    R.assoc(stage, buildStageBatch(stage), result);

  const systemBatches = R.reduce(addStageBatch, {}, Object.keys(systems));
  return setResource(ReservedKeys.SYSTEM_BATCHES, systemBatches, world);
};

const findDepths = (
  systems: System[],
  graph: DepGraph<string>
): Record<string, number> => {
  const systemNames = systems.map(system => system.name);
  const leafSystems = systemNames.filter(
    system => graph.directDependenciesOf(system).length === 0
  );
  const initialNodes = leafSystems.map(system => [system, 0]) as [
    string,
    number,
  ][];

  const q = new Queue(initialNodes);
  const result: Record<string, number> = {};

  while (!q.isEmpty()) {
    const [system, depth] = q.dequeue();
    const neighbours = graph.dependantsOf(system);
    const nextNodes = neighbours.map(neighbour => [
      neighbour,
      Math.max(depth + 1, result[neighbour]),
    ]) as [string, number][];
    nextNodes.forEach(q.enqueue);
    result[system] = depth;
  }
  return result;
};

export const applyStage = (world: World, stage: string): World => {
  const systems = getSystems(world)[stage] ?? new Set<System>();
  if (systems.size === 0) return world;

  // Check if system dependency graph is up to date
  // Rebuild if needed
  if (!isSystemGraphCurrent(world)) {
    world = rebuildSystemDependencyGraph(world);
    world = buildStageBatches(world);
  }

  const stageBatches = getResource(
    ReservedKeys.SYSTEM_BATCHES,
    world
  ) as Record<string, System[][]>;

  const batches = stageBatches[stage];
  if (!batches) return world;

  return R.reduce(applySystems, world, batches);
};

export const applySystems = (world: World, batch: System[]): World => {
  const applySystem = (world: World, system: System) => {
    return applySystemResults(world, system(world));
  };
  return R.reduce(applySystem, world, batch);
};

export const applySystemResults = (
  world: World,
  results: SystemResults
): World => {
  return world;
};

export const step = (world: World): World => {
  return world;
};

export const isFinished = (world: World): boolean => {
  return getResourceOr(false, ReservedKeys.GAME_SHOULD_QUIT, world);
};

const defsys = () => {};
