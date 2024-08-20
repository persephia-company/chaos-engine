import {ComponentStore} from '@/types/store';
import {System} from '@/types/system';
import {WorldAPI, WorldStore} from '@/types/world';
import * as R from 'ramda';
import {SparseComponentStore} from './store';
import {
  Intention,
  extractChangeEntityId,
  isComponentChange,
  isResourceChange,
} from './systems';
import {objAssoc, objDelete, objUpdate} from './util';
import {logger} from './logger';
import {Change, ComponentChange, ResourceChange} from '@/types/change';
import {EntityID} from '..';
import {batchByDepths, buildDependencyGraph, findDepths} from './dependencies';
import {ReservedStages, ReservedKeys} from './keys';

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
    return this.applyChange({method: 'set', path: ['resources', key], value});
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

    // Notify that the relevant stage has changed
    const stageChanges = this.getResourceOr<Set<string>>(
      new Set(),
      ReservedKeys.STAGE_CHANGES
    );
    stageChanges.add(stage);

    return this.setResource(ReservedKeys.SYSTEMS, updatedSystems).setResource(
      ReservedKeys.STAGE_CHANGES,
      stageChanges
    );
  }

  deleteSystem(system: System, stage: string = ReservedStages.UPDATE) {
    logger.debug({msg: 'Deleting System', system: system.name, stage});
    const systems = this.getSystems();
    const stageSystems: Set<System> = R.propOr(
      new Set<System>(),
      stage,
      systems
    );
    stageSystems.delete(system);

    const updatedSystems = R.assoc(stage, stageSystems, systems);

    // Notify that the relevant stage has changed
    const stageChanges = this.getResourceOr<Set<string>>(
      new Set(),
      ReservedKeys.STAGE_CHANGES
    );
    stageChanges.add(stage);

    const result = this.setResource(ReservedKeys.SYSTEMS, updatedSystems);
    return result.setResource(ReservedKeys.STAGE_CHANGES, stageChanges);
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

  buildStageBatches = (stage: string): System[][] => {
    const systems = this.getSystems();
    const systemDependencies = this.getSystemDependencies();

    // A record of system names to the corresponding systems for this stage.
    const systemsOfStage = Array.from(
      (systems[stage] ?? new Set()).values()
    ).reduce(
      (result, system) => {
        return {...result, [system.name]: system};
      },
      {} as Record<string, System>
    );
    //logger.info({
    //  msg: 'Building stage batches',
    //  stage,
    //  systems,
    //  systemsOfStage,
    //});

    const systemNames = Object.keys(systemsOfStage);

    const depths = findDepths(systemNames, systemDependencies);
    return batchByDepths(depths).map(batch =>
      batch.map(name => systemsOfStage[name])
    );
  };

  buildAllStageBatches = (): Record<string, System[][]> => {
    const systems = this.getSystems();

    const stages = Object.keys(systems);
    const batches = stages.reduce(
      (result, stage) => {
        return {...result, [stage]: this.buildStageBatches(stage)};
      },
      {} as Record<string, System[][]>
    );
    this.setResource(ReservedKeys.STAGE_BATCHES, batches);
    return batches;
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
    let world = this.setResource(ReservedKeys.STAGE, stage);

    let stageBatches = world.getResource<Record<string, System[][]>>(
      ReservedKeys.STAGE_BATCHES
    );

    if (stageBatches === undefined) {
      stageBatches = world.buildAllStageBatches();
      world = world.setResource(ReservedKeys.STAGE_BATCHES, stageBatches);
    }

    await world.applyIndividualStage(ReservedStages.PRE_STAGE);
    await world.applyIndividualStage(`pre-${stage}`);
    await world.applyIndividualStage(stage);
    await world.applyIndividualStage(`pre-${stage}`);
    await world.applyIndividualStage(ReservedStages.POST_STAGE);
  };

  /**
   * Helper function that ensures pre_batch and post_batch stages are run
   * around each batch in the supplied stage.
   */
  private async applyIndividualStage(stage: string) {
    const stageBatches = this.getResource<Record<string, System[][]>>(
      ReservedKeys.STAGE_BATCHES
    )!;

    const stageChanges = this.getResourceOr<Set<string>>(
      new Set(),
      ReservedKeys.STAGE_CHANGES
    );

    let batches = stageBatches[stage];
    let world = this as World;

    if (stageChanges.has(stage)) {
      batches = this.buildStageBatches(stage);
      stageChanges.delete(stage);
      world = this.setResource(
        ReservedKeys.STAGE_CHANGES,
        stageChanges
      ).setResource(ReservedKeys.STAGE_BATCHES, {
        ...stageBatches,
        [stage]: batches,
      });
    }
    if (batches === undefined || batches.length === 0) return this;

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
  }

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
    logger.debug({msg: 'applyIntention', intention});

    this.fixIntentionIds(intention);
    logger.debug({
      msg: 'applyIntention with fixed intention ids',
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

    // Get rid of all of the "special" reserved stages
    const stageOrder = graph
      .overallOrder()
      .filter(
        stage =>
          stage === ReservedStages.UPDATE ||
          !(Object.values(ReservedStages) as string[]).includes(stage)
      );

    logger.debug({msg: 'World pre step', this: this});
    const stages = [
      ReservedStages.PRE_STEP,
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
