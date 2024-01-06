import {ComponentStore} from './store';
import {Updateable} from './updateable';

export enum ReservedStages {
  START_UP = 'start-up',
  PRE_STEP = 'pre-step',
  PRE_STAGE = 'pre-stage',
  UPDATE = 'update',
  POST_STAGE = 'post-stage',
  POST_STEP = 'post-step',
  TEAR_DOWN = 'tear-down',
}

export type DataType = 'component' | 'event' | 'resource';

export interface World extends Updateable<unknown> {
  components: Record<string, ComponentStore<unknown>>;
  events: Record<string, unknown[]>;
  resources: Record<string, unknown>;
}
