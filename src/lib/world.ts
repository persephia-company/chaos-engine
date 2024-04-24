import {Entity} from '@/types/entity';
import {ComponentStore} from '@/types/store';
import {System, SystemChange} from '@/types/system';
import {Updateable} from '@/types/updateable';
import {WorldAPI, WorldStore} from '@/types/world';
import {Queue} from '@datastructures-js/queue';
import {DepGraph} from 'dependency-graph';
import stringify from 'json-stable-stringify';
import * as R from 'ramda';
import {SparseComponentStore} from './store';
import {SystemResults, createSystemChange} from './system';
import {
  groupBy,
  hash_cyrb53,
  objAssoc,
  objDelete,
  objUpdate,
  wrap,
} from './util';
import {logger} from './logger';

export const COMPONENTS = 'components';
export const RESOURCES = 'resources';
export const EVENTS = 'events';

export const ReservedKeys = {
  ID: 'id',
  STAGE: 'stage',
  GAME_SHOULD_QUIT: 'game-should-quit',
  SYSTEMS: 'systems',
  SYSTEM_DEPENDENCIES: 'system-dependencies',
  SYSTEM_DEPENDENCY_GRAPH: 'system-dependency-graph',
  SYSTEM_DEPENDENCY_HASH: 'system-dependency-hash',
  SYSTEM_BATCHES: 'system-batches',
  STAGE_DEPENDENCIES: 'stage-dependencies',
  RAW_CHANGES: 'raw-changes',
  MAX_ID: 'max-id',
  ENTITY_REVIVAL_STACK: 'entity-revival-stack',
  ENTITY_DEATHS_DOORS: 'entity-deaths-door',
  RAW_CHANGES_INDEX: 'raw-changes-index',
} as const;

export const ReservedStages = {
  START_UP: 'start-up',
  PRE_STEP: 'pre-step',
  PRE_STAGE: 'pre-stage',
  UPDATE: 'update',
  PRE_BATCH: 'pre-batch',
  POST_BATCH: 'post-batch',
  POST_STAGE: 'post-stage',
  POST_STEP: 'post-step',
  TEAR_DOWN: 'tear-down',
} as const;

export class World implements WorldStore, WorldAPI<World>, Updateable<World> {
  components: Record<string, ComponentStore<unknown>>;
  events: Record<string, unknown[]>;
  resources: Record<string, unknown>;

  constructor(state: Partial<WorldStore> = {}) {
    this.components = state.components ?? {};
    this.events = state.events ?? {};
    this.resources = state.resources ?? {};
  }

  /**
   * Returns all entities within the world.
   */
  getEntities(): Entity[] {
    return this.getComponentStore<Entity>(ReservedKeys.ID).getComponents();
  }

  createEntity(): Entity {
    return this.createEntities(1)[0];
  }

  createEntities(n: number): Entity[] {
    const revivalStack: Set<Entity> = this.getResourceOr(
      new Set(),
      ReservedKeys.ENTITY_REVIVAL_STACK
    );
    const maxEntity: Entity = this.getResourceOr(-1, ReservedKeys.MAX_ID);
    // Pull first from revival stack
    //
    const toRevive = R.take(n, Array.from(revivalStack));
    const toCreate = R.times(i => maxEntity + 1 + i, n - toRevive.length);

    return toRevive.concat(toCreate);
  }

  deleteEntity(id: Entity) {
    for (const store of Object.values(this.components)) {
      store.remove(id);
    }
    return this;
  }

  deleteEntities(ids: Entity[]) {
    for (const store of Object.values(this.components)) {
      for (const id of ids) {
        store.remove(id);
      }
    }
    return this;
  }

  /**
   * Gets the name of all components the supplied entity is a part of.
   */
  getComponentsForEntity(id: Entity): string[] {
    return Object.entries(this.components)
      .filter(([_, store]) => store.hasEntity(id))
      .map(([name, _]) => name);
  }

  setResource = <T>(key: string, value: T) => {
    this.resources[key] = value;
    return this;
  };

  getResourceOr = <T>(otherwise: T, key: string): T => {
    return R.pathOr(otherwise, ['resources', key], this);
  };

  getResource: <T>(key: string) => T | undefined = R.partial(
    this.getResourceOr,
    [undefined]
  );

  getEvents = <T>(key: string): T[] => {
    return (this.events[key] ?? []) as T[];
  };

  getComponentStore<T>(key: string): SparseComponentStore<T> {
    return (
      (this.components[key] as SparseComponentStore<T> | undefined) ??
      new SparseComponentStore()
    );
  }

  getSystems() {
    return this.getResourceOr(
      {} as Record<string, Set<System>>,
      ReservedKeys.SYSTEMS
    );
  }

  private getSystemDependencies() {
    return this.getResourceOr(
      {} as Record<string, Set<string>>,
      ReservedKeys.SYSTEM_DEPENDENCIES
    );
  }

  private getStageDependencies() {
    return this.getResourceOr(
      {} as Record<string, Set<string>>,
      ReservedKeys.STAGE_DEPENDENCIES
    );
  }

  /**
   * Adds a new System to the world.
   */
  addSystem(system: System, stage: string = ReservedStages.UPDATE) {
    logger.debug({msg: 'Adding System', system: system.name, stage});
    const systems = this.getSystems();
    const stageSystems: Set<System> = R.propOr(
      new Set<System>(),
      stage,
      systems
    );
    stageSystems.add(system);

    const updatedSystems = R.assoc(stage, stageSystems, systems);
    return this.setResource(ReservedKeys.SYSTEMS, updatedSystems);
  }

  /**
   * Specify that a system must run after its dependency.
   */
  addSystemDependency = (system: System, dependency: System): World => {
    const dependencies = this.getSystemDependencies();
    const systemDependencies: Set<string> = R.propOr(
      new Set<string>(),
      system.name,
      dependencies
    );
    systemDependencies.add(dependency.name);

    const updatedDependencies = R.assoc(
      system.name,
      systemDependencies,
      dependencies
    );
    return this.setResource(
      ReservedKeys.SYSTEM_DEPENDENCIES,
      updatedDependencies
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

    const updatedStageDependencies = R.assoc(
      stage,
      stageDependencies,
      dependencies
    );

    return this.setResource(
      ReservedKeys.STAGE_DEPENDENCIES,
      updatedStageDependencies
    );
  };

  addPlugin(plugin: (world: World) => World): World {
    return plugin(this);
  }

  /**
   * Queries the world for all supplied components
   */
  query = <T extends any[]>(components: string[]): T[] => {
    logger.debug({name: 'World.query', components});

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

  applyStage = async (stage: string): Promise<World> => {
    const systems = this.getSystems()[stage];
    if (!systems) return this;

    // Update the stage
    // NOTE: not sure if it's best idea to have this call through the api
    let world = this.set<string>(['resources', ReservedKeys.STAGE], stage);

    // Check if system dependency graph is up to date
    // Rebuild if needed
    if (!world.isSystemGraphCurrent()) {
      const graph = world.buildSystemDependencyGraph();
      world = world.setResource(ReservedKeys.SYSTEM_DEPENDENCY_GRAPH, graph);

      const stageBatches = world.buildStageBatches();
      world = world.setResource(ReservedKeys.SYSTEM_BATCHES, stageBatches);
    }

    const stageBatches = world.getResource(
      ReservedKeys.SYSTEM_BATCHES
    ) as Record<string, System[][]>;

    const _applyStage = async (_stage: string, world: World) => {
      const batches = stageBatches[_stage];
      if (!batches) return world;

      const applySystemsBatch = async (
        world: World,
        batch: System[]
      ): Promise<World> => {
        const rawResults = await Promise.all(batch.map(this.applySystem));
        // Join the results into one big one
        // TODO: make more efficient
        const systemResults = rawResults.filter(
          result => result !== undefined
        ) as SystemResults[];

        const finalResult = systemResults.reduce(
          (res, next) => res.merge(next),
          new SystemResults()
        );
        return world.applySystemResults(finalResult);
      };

      const applyBatchInterleaved = async (
        world: World,
        batch: System[]
      ): Promise<World> => {
        const batches = [
          ...(stageBatches[ReservedStages.PRE_BATCH] ?? []),
          batch,
          ...(stageBatches[ReservedStages.POST_BATCH] ?? []),
        ];
        for (const batch of batches) {
          world = await applySystemsBatch(world, batch);
        }
        return world;
      };

      for (const batch of batches) {
        world = await applyBatchInterleaved(world, batch);
      }
      return world;
    };

    logger.debug(`PRE-STAGE ${stage}`);
    world = await _applyStage(ReservedStages.PRE_STAGE, world);
    logger.debug(`STAGE ${stage}`);
    world = await _applyStage(stage, world);
    logger.debug(`POST-STAGE ${stage}`);
    world = await _applyStage(ReservedStages.POST_STAGE, world);
    return world;
  };

  applySystem = async (system: System) => {
    logger.debug({msg: `applySystem: ${system.name}`, system: system.name});
    return system(this);
  };

  /**
   * Applies a set of changes contained in some SystemResults, one by one, to
   * the world.
   */
  applySystemResults = (results: SystemResults): World => {
    // NOTE: We could eventually make it so that all this does is add the raw results to the event queue.
    // Then all the remaining behaviour could be accomplished with systems...
    logger.debug({msg: 'Apply System Results', results});

    const applyChange = (world: World, change: SystemChange<any>): World => {
      // NOTE: Wrap with ids before we add the RAW event.
      if (
        change.method === 'add' &&
        change.path[0] === COMPONENTS &&
        !wrap(change.ids).length
      ) {
        change.ids = world.createEntities(wrap(change.value).length);
      }
      return world
        .add([EVENTS, ReservedKeys.RAW_CHANGES], change)
        .applySystemChange(change);
    };
    return R.reduce(applyChange, this, results.changes);
  };

  private applySystemChange = (change: SystemChange<any>): World => {
    switch (change.method) {
      case 'add':
        return this.add(change.path, change.value, change.ids);
      case 'delete':
        return this.delete(change.path, change.value, change.ids);
      case 'set':
        return this.set(change.path, change.value, change.ids);
      case 'update':
        return this.update(change.path, change.value, change.ids);
    }
  };

  private buildStageDependencyGraph = () => {
    const stages = Object.keys(this.getSystems());

    const dependencies = this.getStageDependencies();
    return buildDependencyGraph(stages, dependencies);
  };

  async step(this: this) {
    logger.debug('STEPPING');

    // TODO: Cache this
    const graph = this.buildStageDependencyGraph();
    const stageOrder = graph
      .overallOrder()
      .filter(
        stage => !(Object.values(ReservedStages) as string[]).includes(stage)
      );

    logger.debug({msg: 'World pre step', this: this});
    const stages = [
      ReservedStages.PRE_STEP,
      ReservedStages.UPDATE,
      ...stageOrder,
      ReservedStages.POST_STEP,
    ];

    // NOTE: This has broken out of the functional idea
    for (const stage of stages) {
      await this.applyStage(stage);
    }
    logger.debug({msg: 'World post step', world: this});
    return this;
  }

  isFinished = (): boolean => {
    return this.getResourceOr(false, ReservedKeys.GAME_SHOULD_QUIT);
  };

  async play() {
    let world = await this.applyStage(ReservedStages.START_UP);
    while (!world.isFinished()) {
      world = await world.step();
    }
    return await world.applyStage(ReservedStages.TEAR_DOWN);
  }

  private updateComponentStore<T>(
    key: string,
    fn: (store: ComponentStore<T>) => ComponentStore<T>
  ): World {
    this.components[key] = fn(this.getComponentStore(key));
    return this;
  }

  private setComponentStore<T>(key: string, store: ComponentStore<T>): World {
    return this.updateComponentStore(key, () => store);
  }

  forwardToComponents<T>(change: SystemChange<T>): World {
    const {method, path, value} = change;

    const ids = wrap(change.ids);

    logger.debug({msg: 'forwarding to components', change, ids});

    // Call the appropriate method on the store
    const component = path[1];
    const remainingPath = R.drop(2, path);
    let store = this.getComponentStore(component);
    store = store[method](remainingPath, value as any, ids);

    const result = this.setComponentStore(component, store);

    // If we're directly modifying ids, we're done.
    if (component === ReservedKeys.ID) return result;

    // Otherwise, might need to also create the appropriate ids
    let idStore = this.getComponentStore<Entity>(ReservedKeys.ID);
    if (method === 'add' || method === 'set') {
      for (const id of ids) {
        idStore = idStore.insert(id, id);
      }
    }

    // Update our worlds stores to reflect our changes
    return result.setComponentStore(ReservedKeys.ID, idStore);
  }

  add<T>(path: string[], values: T | T[], ids?: number | number[]): World {
    if (path[0] === 'components') {
      // Add Entity IDs if not specified.
      if (wrap(ids).length === 0) {
        ids = this.createEntities(wrap(values).length);
        logger.debug({
          msg: 'No ids found for World.add, adding our own...',
          path,
          values,
          ids,
        });
      }
      // TODO: check validity
      const change = createSystemChange('add', path, values, ids);
      return this.forwardToComponents(change);
    }

    if (path[0] === 'events') {
      const event = path[1];
      let events = this.getEvents(event);
      events = events.concat(wrap(values));
      // TODO: Could just make imperative
      objAssoc(['events', event], events, this);
      return this;
    }

    // Otherwise check we don't overwrite anything
    if (R.path(path, this) === undefined) {
      objAssoc(path, values, this);
    }

    return this;
  }

  set<T>(path: string[], values: T | T[], ids?: number | number[]): World {
    // TODO: check validity
    if (path[0] === COMPONENTS) {
      return this.forwardToComponents(
        createSystemChange<T>('set', path, values, ids)
      );
    }
    objAssoc(path, values, this);
    return this;
  }

  delete(
    path: string[],
    values?: string | string[],
    ids?: number | number[]
  ): World {
    // TODO: check validity
    if (path[0] !== COMPONENTS) {
      objDelete(path, wrap(values), this);
      return this;
    }

    // Must be components
    // NOTE: Pulled into plugin changes.executeEntities
    // Special case where we delete the entity
    // if (path[1] === ReservedKeys.ID) {
    //   return this.deleteEntities(wrap(ids));
    // }

    return this.forwardToComponents(
      createSystemChange('delete', path, values, ids) as SystemChange<unknown>
    );
  }

  update<T>(
    path: string[],
    f: (value: T) => T,
    ids?: number | number[]
  ): World {
    // TODO: check validity
    if (path[0] === COMPONENTS) {
      return this.forwardToComponents(
        createSystemChange('update', path, f, ids)
      );
    }
    objUpdate(path, f, this);
    return this;
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

  const calculateDepth = (currentDepth: number, system: string) => {
    return Math.max(currentDepth + 1, result[system] ?? 0);
  };

  while (!q.isEmpty()) {
    const [system, depth] = q.dequeue();
    const neighbours = graph.dependantsOf(system);
    const nextNodes = neighbours.map(neighbour => [
      neighbour,
      calculateDepth(depth, neighbour),
    ]) as [string, number][];
    nextNodes.forEach(v => q.enqueue(v));
    result[system] = depth;
  }
  return result;
};
