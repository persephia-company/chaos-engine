import {Entity} from '@/types/entity';
import {ComponentStore} from '@/types/store';
import {System, SystemChange} from '@/types/system';
import {ReservedStages} from '@/types/world';
import * as R from 'ramda';
import {DepGraph} from 'dependency-graph';
import stringify from 'json-stable-stringify';
import {groupBy, hash_cyrb53, wrap} from './util';
import {Queue} from '@datastructures-js/queue';
import {SystemResults, createSystemChange} from './system';
import {Key, Updateable} from '@/types/updateable';
import {SparseComponentStore} from './store';

export enum ReservedKeys {
  GAME_SHOULD_QUIT = 'game-should-quit',
  SYSTEMS = 'systems',
  SYSTEM_DEPENDENCIES = 'system-dependencies',
  SYSTEM_DEPENDENCY_GRAPH = 'system-dependency-graph',
  SYSTEM_DEPENDENCY_HASH = 'system-dependency-hash',
  SYSTEM_BATCHES = 'system-batches',
  STAGE_DEPENDENCIES = 'stage-dependencies',
  RAW_CHANGES = 'raw-changes',
  MAX_ENTITY = 'max-entity',
  ENTITY_REVIVAL_QUEUE = 'entity-revival-queue',
}

export class World implements Updateable<unknown> {
  components: Record<string, ComponentStore<unknown>>;
  events: Record<string, unknown[]>;
  resources: Record<string, unknown>;

  constructor(state: Partial<World> = {}) {
    this.components = state.components ?? {};
    this.events = state.events ?? {};
    this.resources = state.resources ?? {};
  }

  /**
   * Returns all entities within the world.
   */
  getEntities(): Entity[] {
    return this.getComponentStore<Entity>('id').getComponents();
  }

  createEntity(): Entity {
    return this.createEntities(1)[0];
  }

  createEntities(n: number): Entity[] {
    const revivalQueue: Entity[] = this.getResourceOr(
      [],
      ReservedKeys.ENTITY_REVIVAL_QUEUE
    );
    const maxEntity: Entity = this.getResourceOr(-1, ReservedKeys.MAX_ENTITY);
    const toRevive = R.take(n, revivalQueue);
    const toCreate = R.times(i => maxEntity + 1 + i, n - toRevive.length);

    return toRevive.concat(toCreate);
  }

  setResource = R.curry(<T>(key: string, value: T) => {
    return R.assocPath(['resources', key], value, this);
  });

  // TODO: Delete entity which cleans up all components

  getResourceOr = R.curry(
    <T>(otherwise: T | undefined, key: string): T | undefined => {
      return R.pathOr(otherwise, ['resources', key], this);
    }
  );

  getResource: <T = unknown>(key: string) => T | undefined =
    this.getResourceOr(undefined);

  getEvents = <T = unknown>(key: string): T[] => {
    return R.pathOr([], ['events', key], this);
  };

  /**
   * Returns a map of stages to their included systems within the world
   */
  getSystems: () => Record<string, Set<System>> = this.getResourceOr(
    {} as Record<string, Set<System>>,
    ReservedKeys.SYSTEMS
  );

  /**
   * Returns a map of systems to their dependencies
   */
  private getSystemDependencies: () => Record<string, Set<string>> =
    this.getResourceOr(
      {} as Record<string, Set<string>>,
      ReservedKeys.SYSTEM_DEPENDENCIES
    );

  /**
   * Returns a map of stages to their dependencies
   */
  private getStageDependencies: () => Record<string, Set<string>> =
    this.getResourceOr(
      {} as Record<string, Set<string>>,
      ReservedKeys.STAGE_DEPENDENCIES
    );

  /**
   * Adds a new System to the world.
   */
  addSystem = (system: System, stage: string = ReservedStages.UPDATE) => {
    const systems = this.getSystems();
    const stageSystems: Set<System> = R.propOr(
      new Set<System>(),
      stage,
      systems
    );
    stageSystems.add(system);

    const updateSystems = this.setResource(ReservedKeys.SYSTEMS);
    return updateSystems(R.assoc(stage, stageSystems, systems));
  };

  addSystemDependency = (system: System, dependency: System): World => {
    const dependencies = this.getSystemDependencies();
    const systemDependencies: Set<string> = R.propOr(
      new Set<string>(),
      system.name,
      dependencies
    );
    systemDependencies.add(dependency.name);

    const updateDependencies = this.setResource(
      ReservedKeys.SYSTEM_DEPENDENCIES
    );
    return updateDependencies(
      R.assoc(system.name, systemDependencies, dependencies)
    );
  };

  addStageDependency = (stage: string, dependency: string): World => {
    const dependencies = this.getSystemDependencies();
    const stageDependencies: Set<string> = R.propOr(
      new Set<string>(),
      stage,
      dependencies
    );
    stageDependencies.add(dependency);

    const updateStageDependencies = this.setResource(
      ReservedKeys.STAGE_DEPENDENCIES
    );
    return updateStageDependencies(
      R.assoc(stage, stageDependencies, dependencies)
    );
  };

  /**
   * Queries the world for all supplied components
   */
  query = <T extends any[]>(components: string[]): T[] => {
    const componentStores = components
      .map(component => this.components[component])
      .filter(store => store !== undefined);

    if (
      componentStores.length !== components.length ||
      components.length === 0
    ) {
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

  private buildSystemDependencyGraph = () => {
    const systems = Object.values(this.getSystems())
      .flatMap(s => Array.from(s.values()))
      .map(system => system.name);

    const dependencies = this.getSystemDependencies();
    return buildDependencyGraph(systems, dependencies);
  };

  private hashSystems = (): number => {
    const systems = Object.values(this.getSystems())
      .flatMap(s => Array.from(s.values()))
      .map(system => system.name);

    const rawDependencies = this.getSystemDependencies();
    const dependencies = Object.fromEntries(
      Object.entries(rawDependencies).map(([node, deps]) => [
        node,
        Array.from(deps.values()),
      ])
    );
    return hash_cyrb53(stringify({systems, dependencies}));
  };

  private isSystemGraphCurrent = (): boolean => {
    return (
      this.getResource(ReservedKeys.SYSTEM_DEPENDENCY_HASH) ===
      this.hashSystems()
    );
  };

  private buildStageBatches = (): Record<string, System[][]> => {
    const systems = this.getSystems();
    const graph = this.getResource(
      ReservedKeys.SYSTEM_DEPENDENCY_GRAPH
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

    return R.reduce(addStageBatch, {}, Object.keys(systems));
  };

  applyStage = (stage: string): World => {
    const systems = this.getSystems()[stage];
    if (!systems) return this;

    let world = new World({...this});
    // Check if system dependency graph is up to date
    // Rebuild if needed
    if (!this.isSystemGraphCurrent()) {
      const graph = this.buildSystemDependencyGraph();
      const stageBatches = world.buildStageBatches();

      world = world.setResource(ReservedKeys.SYSTEM_DEPENDENCY_GRAPH, graph);
      world = world.setResource(ReservedKeys.SYSTEM_BATCHES, stageBatches);
    }

    const stageBatches = world.getResource(
      ReservedKeys.SYSTEM_BATCHES
    ) as Record<string, System[][]>;

    const batches = stageBatches[stage];
    if (!batches) return world;

    const applySystems = (world: World, batch: System[]): World => {
      return R.reduce(
        (world, system) => world.applySystem(system),
        world,
        batch
      );
    };

    return R.reduce(applySystems, world, batches);
  };

  applySystem = (system: System) => {
    return this.applySystemResults(system(this));
  };

  applySystemResults = (results: SystemResults<unknown>): World => {
    const applyChange = (
      world: World,
      change: SystemChange<unknown>
    ): World => {
      // Appends each raw change as a new event for plugins to inspect
      world = world.add(['events', ReservedKeys.RAW_CHANGES], change);
      const fn = world[change.method];

      return fn(change.path, change.value as any, change.ids as any);
    };

    return R.reduce(applyChange, this, results.changes);
  };

  private buildStageDependencyGraph = () => {
    const stages = Object.keys(this.getSystems());

    const dependencies = this.getStageDependencies();
    return buildDependencyGraph(stages, dependencies);
  };

  step = (): World => {
    // TODO: Cache this
    const graph = this.buildStageDependencyGraph();
    const stageOrder = graph
      .overallOrder()
      .filter(
        stage => !(Object.values(ReservedStages) as string[]).includes(stage)
      );

    let world = this.applyStage(ReservedStages.PRE_STEP);
    world = world.applyStage(ReservedStages.UPDATE);
    // Perform user defined stages.
    world = R.reduce(
      (world, stage) => world.applyStage(stage),
      world,
      stageOrder
    );
    return world.applyStage(ReservedStages.POST_STEP);
  };

  isFinished = (): boolean => {
    return this.getResourceOr(false, ReservedKeys.GAME_SHOULD_QUIT);
  };

  play() {
    // TODO: Make not functional
    let world = this.applyStage(ReservedStages.START_UP);
    while (!world.isFinished()) {
      world = world.step();
    }
    return world.applyStage(ReservedStages.TEAR_DOWN);
  }

  getComponentStore<T>(key: string): ComponentStore<T> {
    return (
      (this.components[key] as ComponentStore<T> | undefined) ??
      new SparseComponentStore()
    );
  }

  forwardToComponents(change: SystemChange<unknown>): World {
    const {method, path, value} = change;
    if (path.length < 2) {
      console.warn('Invalid change: ', change);
      return this;
    }
    const component = path[1];
    const remainingPath = R.drop(2, path);
    let store = this.getComponentStore(component as string);
    store = store[method](
      remainingPath,
      value as any
    ) as ComponentStore<unknown>;

    let entities = this.getComponentStore<Entity>('id');
    const ids = wrap(change.ids);
    entities = R.reduce(
      (store: typeof entities, id: Entity) => store.insert(id, id),
      entities,
      ids
    );
    const result: World = R.assocPath(['components', component], store, this);
    return R.assocPath(['components', 'id'], entities, result);
  }

  add(
    path: Key[],
    values: unknown | unknown[],
    ids?: number | number[]
  ): World {
    if (path[0] === 'components') {
      // If missing ids, create some.
      if (ids === undefined) {
        ids = this.createEntities(wrap(values).length);
      }
      return this.forwardToComponents(
        createSystemChange('add', path, values, ids)
      );
    }

    if (path[0] === 'events') {
      const event = path[1];
      let events = this.getEvents(event as string);
      events = events.concat(wrap(values));
      return R.assocPath(['events', event], events, this);
    }

    // Otherwise check we don't overwrite anything
    if (R.path(path, this) !== undefined) {
      return this;
    }

    return R.assocPath(path, values, this);
  }

  set(
    path: Key[],
    values: unknown | unknown[],
    ids?: number | number[]
  ): World {
    if (path[0] === 'components') {
      return this.forwardToComponents(
        createSystemChange('add', path, values, ids)
      );
    }
    return R.assocPath(path, values, this);
  }

  delete(
    path: Key[],
    values?: string | string[],
    ids?: number | number[]
  ): World {
    if (path[0] === 'components') {
      return this.forwardToComponents(
        createSystemChange('delete', path, values, ids) as SystemChange<unknown>
      );
    }
    return R.modifyPath(path, R.omit(wrap(values)), this);
  }

  update(
    path: Key[],
    f: (value: unknown) => unknown,
    ids: number | number[]
  ): World {
    if (path[0] === 'components') {
      return this.forwardToComponents(
        createSystemChange('update', path, f, ids)
      );
    }
    return R.modifyPath(path, f, this);
  }
}

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
