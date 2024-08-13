import {ComponentStore} from '@/types/store';
import {System} from '@/types/system';
import {WorldAPI, WorldStore} from '@/types/world';
import {Queue} from '@datastructures-js/queue';
import {DepGraph} from 'dependency-graph';
import stringify from 'json-stable-stringify';
import * as R from 'ramda';
import {SparseComponentStore} from './store';
import {
  Intention,
  extractChangeEntityId,
  isComponentChange,
  isResourceChange,
} from './systems';
import {groupBy, hash_cyrb53, objAssoc, objDelete, objUpdate} from './util';
import {logger} from './logger';
import {Change, ComponentChange, ResourceChange} from '@/types/change';
import {EntityID} from '..';

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

export class World implements WorldStore, WorldAPI<World> {
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
  getEntities(): number[] {
    return this.getComponentStore<number>(ReservedKeys.ID).getComponents();
  }

  /**
   * Returns the id of the next entity to be created.
   *
   * Note: Doesn't actually create the entity.
   */
  createEntity(): number {
    return this.createEntities(1)[0];
  }

  createEntities(n: number): number[] {
    const revivalStack: Set<number> = this.getResourceOr(
      new Set(),
      ReservedKeys.ENTITY_REVIVAL_STACK
    );
    const maxEntity: number = this.getResourceOr(-1, ReservedKeys.MAX_ID);

    // Pull from revival stack, first
    const toRevive = R.take(n, Array.from(revivalStack));
    const toCreate = R.times(i => maxEntity + 1 + i, n - toRevive.length);

    return toRevive.concat(toCreate);
  }

  deleteEntity(id: EntityID) {
    for (const store of Object.values(this.components)) {
      store.remove(id);
    }
    return this;
  }

  deleteEntities(ids: EntityID[]) {
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
  getComponentsForEntity(id: EntityID): string[] {
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

  /**
   * Get the results of all systems in a batch, join them and apply them to the world.
   */
  private async applySystemsBatch(batch: System[]): Promise<World> {
    const rawResults = await Promise.all(batch.map(this.applySystem));
    logger.debug({msg: 'Batch Raw Results', rawResults});
    // Join the results into one big one
    // TODO: make more efficient
    const systemResults = rawResults.filter(
      result => result !== undefined
    ) as Intention[];

    const finalResult = systemResults.reduce(
      (res, next) => res.merge(next),
      new Intention()
    );

    return this.applyIntention(finalResult);
  }

  applyStage = async (stage: string): Promise<void> => {
    const systems = this.getSystems()[stage];
    if (!systems) return;

    // Update the stage
    let world = this.applyChange<string>({
      path: ['resources', ReservedKeys.STAGE],
      method: 'set',
      value: stage,
    });

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

    /**
     * Helper function that ensures pre_batch and post_batch stages are run
     * around each batch in the supplied stage.
     */
    const _applyStage = async (_stage: string, world: World) => {
      const batches = stageBatches[_stage];
      if (!batches) return world;

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
          world = await world.applySystemsBatch(batch);
        }
        return world;
      };

      for (const batch of batches) {
        world = await applyBatchInterleaved(world, batch);
      }
      return world;
    };

    logger.debug(`PRE-STAGE ${stage}`);
    await _applyStage(ReservedStages.PRE_STAGE, world);
    logger.debug(`STAGE ${stage}`);
    await _applyStage(stage, world);
    logger.debug(`POST-STAGE ${stage}`);
    await _applyStage(ReservedStages.POST_STAGE, world);
  };

  applySystem = async (system: System): Promise<Intention | void> => {
    logger.debug({msg: `applySystem: ${system.name}`, system: system.name});
    return await system(this);
  };

  /**
   * Replaces all the relative ids in the supplied results with fixed ids from
   * the world.
   */
  private fixIntentionIds = (results: Intention): void => {
    const offsets = Array.from(results.getUsedOffsets().values());
    const newIds = this.createEntities(offsets.length);

    offsets.forEach((offset, i) => {
      results.replaceAllUnborn(offset, newIds[i]);
    });
  };

  /**
   * Applies a set of changes contained in some SystemResults, one by one, to
   * the world.
   */
  applyIntention = (intention: Intention): World => {
    // NOTE: We could eventually make it so that all this does is add the raw results to the event queue.
    // Then all the remaining behaviour could be accomplished with systems...
    logger.debug({msg: 'applySystemResults', intention});

    this.fixIntentionIds(intention);
    logger.debug({
      msg: 'applySystemResults with fixed intention ids',
      intention,
    });

    let result = this as World;
    for (const change of intention.extractRealChanges()) {
      result = result.applyChange(extractChangeEntityId(change));
    }
    return result;
  };

  applyChange = <T>(change: Change<T, EntityID>): World => {
    // Add the raw change to the events
    const result = this.addEvent(ReservedKeys.RAW_CHANGES, change);

    // Process the change
    if (isComponentChange(change)) {
      return result.forwardToComponents(change);
    }
    if (isResourceChange(change)) {
      return result.applyResourceChange(change);
    }

    // Change must be an event
    const eventName = change.path[1];

    if (change.method === 'delete') {
      return this.resetEvents(eventName);
    }

    return this.addEvent(eventName, change.value);
  };

  private addEvent<T>(eventName: string, value: T) {
    const events = this.getEvents(eventName);
    events.push(value);

    this.events[eventName] = events;
    return this;
  }

  private resetEvents(eventName: string) {
    this.events[eventName] = [];
    return this;
  }

  private applyResourceChange<T>(change: ResourceChange<T>): World {
    const resourceName = change.path[1];
    switch (change.method) {
      case 'add':
        if (this.resources[resourceName] !== undefined) {
          return this;
        }
        objAssoc(change.path, change.value, this);
        return this;
      case 'set':
        objAssoc(change.path, change.value, this);
        return this;
      case 'update':
        objUpdate(change.path, change.fn, this);
        return this;
      case 'delete':
        objDelete(change.path, [], this);
        return this;
    }
  }

  private buildStageDependencyGraph = () => {
    const stages = Object.keys(this.getSystems());

    const dependencies = this.getStageDependencies();
    return buildDependencyGraph(stages, dependencies);
  };

  async step() {
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

    for (const stage of stages) {
      await this.applyStage(stage);
    }
    logger.debug({msg: 'World post step', world: this});
  }

  async stepN(n: number) {
    for (let i = 0; i < n; i++) {
      await this.step();
    }
  }

  isFinished = (): boolean => {
    return this.getResourceOr(false, ReservedKeys.GAME_SHOULD_QUIT);
  };

  async play() {
    await this.applyStage(ReservedStages.START_UP);
    while (!this.isFinished()) {
      await this.step();
    }
    await this.applyStage(ReservedStages.TEAR_DOWN);
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

  forwardToComponents<T>(change: ComponentChange<T, EntityID>): World {
    const {method, path} = change;
    logger.debug({msg: 'forwarding to components', change});

    // Call the appropriate method on the store
    const component = path[1];
    const store = this.getComponentStore<T>(component).handleChange(change);

    const result = this.setComponentStore(component, store);

    // If we're directly modifying ids, we're done.
    if (component === ReservedKeys.ID) return result;

    // Otherwise, might need to also create the appropriate ids
    let idStore = this.getComponentStore<number>(ReservedKeys.ID);
    if (method === 'add' || method === 'set') {
      if (change.id !== undefined) {
        idStore = idStore.insert(change.id, change.id);
      }
    }

    // Update our worlds stores to reflect our changes
    return result.setComponentStore(ReservedKeys.ID, idStore);
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
