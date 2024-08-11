import {
  Change,
  ChangeType,
  ComponentChange,
  EventChange,
  ResourceChange,
} from '@/types/change';
import {Entity, EntityID, RealEntity} from '@/types/entity';
import {ID, fixedID, hasOffset, isFixed} from '../entity';

export const CHANGE_EVENT_DIVIDER = '-->';

/**
 * Returns the unique identifier used for changeEvents of a specific key and method.
 *
 * Useful in conjunction with @see defsys, to specify that a system is dependent on a
 * certain changeEvent, e.g. run this system every time the player's health changes.
 *
 * @example
 * defsys({events: [changeEventName('update', 'player-hp')]}, ...etc)
 */
export const changeEventName = (
  method: ChangeType | 'created' | 'modified',
  key: string
) => {
  return `${method}${CHANGE_EVENT_DIVIDER}${key}`;
};

export const isChangeEvent = (change: Change): boolean => {
  const key = change.path[1];
  return key.includes(CHANGE_EVENT_DIVIDER);
};

export const isComponentChange = <T, ID = Entity>(
  change: Change<T, ID>
): change is ComponentChange<T, ID> => {
  return change.path[0] === 'components';
};

export const isResourceChange = <T, ID = Entity>(
  change: Change<T, ID>
): change is ResourceChange<T> => {
  return change.path[0] === 'resources';
};

export const isEventChange = <T, ID = Entity>(
  change: Change<T, ID>
): change is EventChange<T> => {
  return change.path[0] === 'components';
};

export const hasID = <T, ID = Entity>(change: Change<T, ID>): boolean => {
  return isComponentChange(change) && change.id !== undefined;
};

/**
 * If the change has an UnbornEntity for an Id,
 * increase it's offset by the supplied amount.
 */
export const incrementChangeOffset = <T>(
  change: Change<T, Entity>,
  amount: number
): Change<T, Entity> => {
  if (!isComponentChange(change)) return change;

  if (change.id === undefined || isFixed(change.id)) {
    return change;
  }
  const id = ID.relative(change.id.offset + amount);
  return {...change, id};
};

/**
 * Converts this change from having an Entity as its id,
 * to having just the EntityID (a number) as its id.
 */
export const extractChangeEntityId = <T>(
  change: Change<T, RealEntity>
): Change<T, EntityID> => {
  if (!isComponentChange(change) || change.id === undefined) {
    // @ts-ignore: If previous change.id was undefined, there will be no issue converting.
    return {...change, id: undefined};
  }
  const id = change.id.id;
  return {...change, id};
};

/**
 * If the change is for an unborn entity, and that entity has the
 * supplied offset, replace it with a new real Entity of the supplied id.
 */
export const replaceUnborn = <T>(
  change: Change<T, Entity>,
  offset: number,
  id: EntityID
): Change<T, Entity> => {
  if (
    !isComponentChange(change) ||
    change.id === undefined ||
    isFixed(change.id)
  ) {
    return change;
  }

  if (!hasOffset(change.id, offset)) {
    return change;
  }

  return {...change, id: fixedID(id)};
};
