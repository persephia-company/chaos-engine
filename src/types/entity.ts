export type EntityID = number;

export type RealEntity = {
  exists: true;
  id: EntityID;
};

export type UnbornEntity = {
  exists: false;
  offset: number;
};

/**
 * A discriminated union representing an Entity that may or may not exist.
 */
export type Entity = RealEntity | UnbornEntity;
