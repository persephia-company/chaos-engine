import {SystemResults} from '..';
import {Entity} from './entity';
import ComponentStore from './store';
import {System} from './system';

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

export type WorldStore = {
  components: Record<string, ComponentStore<unknown>>;
  events: Record<string, unknown[]>;
  resources: Record<string, unknown>;
};

export interface WorldAPI<A> {
  createEntity: () => Entity;
  createEntities: (n: number) => Entity[];
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
  applyStage: (stage: string) => A;
  applySystem: (system: System) => A;
  applySystemResults: (results: SystemResults) => A;
  step: () => A;
  isFinished: () => boolean;
  play: () => A;
}

export type DataType = 'component' | 'event' | 'resource';
