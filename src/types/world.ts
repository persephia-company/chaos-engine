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
