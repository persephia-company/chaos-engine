import {SystemResults} from '..';
import {Entity} from './entity';
import ComponentStore from './store';
import {System} from './system';

export type WorldStore = {
  components: Record<string, ComponentStore<unknown>>;
  events: Record<string, unknown[]>;
  resources: Record<string, unknown>;
};

export interface WorldAPI<A> {
  createEntity: () => Entity;
  createEntities: (n: number) => Entity[];
  deleteEntity: (id: Entity) => A;
  deleteEntities: (ids: Entity[]) => A;
  getResourceOr: <T>(or: T, key: string) => T;
  getResource: <T>(key: string) => T | undefined;
  setResource: <T>(key: string, value: T) => A;
  getEvents: <T>(key: string) => T[];
  getSystems: () => Record<string, Set<System>>;
  getComponentStore: <T>(key: string) => ComponentStore<T>;
  addSystem: (system: System, stage?: string) => A;
  addSystemDependency: (system: System, dependency: System) => A;
  addStageDependency: (stage: string, dependency: string) => A;
  addPlugin: (plugin: (world: A) => A) => A;
  query: <T extends any[]>(components: string[]) => T[];
  applyStage: (stage: string) => Promise<A>;
  applySystem: (system: System) => Promise<SystemResults | void>;
  applySystemResults: (results: SystemResults) => A;
  step: () => Promise<A>;
  play: () => Promise<A>;
  isFinished: () => boolean;
}

export type DataType = 'components' | 'events' | 'resources';
