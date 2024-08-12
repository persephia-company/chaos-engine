import {Entity, RealEntity, UnbornEntity} from '..';

export const realID = (id: number): RealEntity => ({
  exists: true,
  id,
});

export const relativeID = (offset: number): UnbornEntity => ({
  exists: false,
  offset,
});

export const ID = {
  fixed: realID,
  relative: relativeID,
  real: realID,
  unborn: relativeID,
} as const;

export const isReal = (id: Entity): id is RealEntity => id.exists;

export const isUnborn = (id: Entity): id is UnbornEntity => !id.exists;

export const hasRealIdOfValue = (id: Entity, value: number) => {
  return id.exists && id.id === value;
};

export const hasOffset = (id: Entity, offset: number) => {
  return !id.exists && id.offset === offset;
};
