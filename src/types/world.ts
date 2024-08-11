import {Intention} from '@/lib/systems';
import ComponentStore from './store';
import {System} from './system';

export type WorldStore = {
  components: Record<string, ComponentStore<unknown>>;
  events: Record<string, unknown[]>;
  resources: Record<string, unknown>;
};

export interface WorldAPI<A> {
  getResourceOr: <T>(or: T, key: string) => T;
  getResource: <T>(key: string) => T | undefined;
  setResource: <T>(key: string, value: T) => void;
  getEvents: <T>(key: string) => T[];
  getSystems: () => Record<string, Set<System>>;
  getComponentStore: <T>(key: string) => ComponentStore<T>;
  addSystem: (system: System, stage?: string) => A;
  addSystemDependency: (system: System, dependency: System) => A;
  addStageDependency: (stage: string, dependency: string) => A;
  addPlugin: (plugin: (world: A) => A) => A;
  query: <T extends any[]>(components: string[]) => T[];
  applyStage: (stage: string) => Promise<void>;
  applySystem: (system: System) => Promise<Intention | void>;
  applyIntention: (intention: Intention) => void;
  stepN: (n: number) => Promise<void>;
  step: () => Promise<void>;
  play: () => Promise<void>;
  isFinished: () => boolean;
}

export type DataType = 'components' | 'events' | 'resources';
