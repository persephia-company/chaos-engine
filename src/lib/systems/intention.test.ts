import {describe, it, expect} from 'vitest';
import {Intention} from './intention';
import {fixedID, hasID, hasOffset} from '../entity';
import {isComponentChange} from './change';
import {logger} from '../logger';

describe('Intentions', () => {
  it('Should be empty when initialised', () => {
    expect(new Intention().changes.length).toBe(0);
  });

  it('Should allow multiple adds', () => {
    const intention = new Intention()
      .addComponent('test', 1)
      .addComponent('test', 2);
    expect(intention.changes.length).toBe(2);
  });

  it('Should be able to generate an id', () => {
    const intention = new Intention();
    const id = intention.createID();
    expect(!id.exists && id.offset === 1).true;
    expect(intention.generatedIds === 1).true;
  });

  it('Merging intentions should preserve ids', () => {
    let intention = new Intention();
    const id = intention.createID();
    intention = intention.addComponent('test', 1, id);

    let otherIntention = new Intention();

    const otherId = otherIntention.createID();
    otherIntention = otherIntention.addComponent('test', 1, otherId);

    const mergedIntention = intention.merge(otherIntention);
    expect(mergedIntention.generatedIds === 2).true;
    expect(
      mergedIntention.changes.some(change => {
        return (
          isComponentChange(change) &&
          change.id !== undefined &&
          hasOffset(change.id, 1)
        );
      })
    ).true;
    expect(
      mergedIntention.changes.some(change => {
        return (
          isComponentChange(change) &&
          change.id !== undefined &&
          hasOffset(change.id, 2)
        );
      })
    ).true;
  });

  // TODO: Write
  it("Check adding components without ids doesn't clash with relative ids", () => {});

  it('Should allow bundles with specified fixed ids', () => {
    const bundle = {
      hp: 10,
      armor: 'heavy',
    };
    const intention = new Intention().addBundle(bundle, fixedID(1));
    expect(intention.changes.length).toBe(2);
    expect(
      intention.changes.every(change => {
        return isComponentChange(change) && hasID(change.id!, 1);
      })
    ).true;
  });

  it('Should allow bundles with relative ids', () => {
    const bundle = {
      hp: 10,
      armor: 'heavy',
    };

    const intention = new Intention().addBundle(bundle);
    logger.error(intention);
    expect(intention.changes.length).toBe(2);
    expect(
      intention.changes.every(change => {
        return isComponentChange(change) && hasOffset(change.id!, 1);
      })
    ).true;
    expect(intention.generatedIds === 1).true;
  });
});
