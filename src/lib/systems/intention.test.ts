import {describe, it, expect} from 'vitest';
import {Intention} from './intention';
import {ID, fixedID, hasID, hasOffset} from '../entity';
import {isComponentChange} from './change';
import {UnbornEntity} from '@/types/entity';

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

  it('Should be able to generate multiple ids', () => {
    const intention = new Intention();
    const ids = intention.createIDs(5);
    for (let i = 0; i < 5; i++) {
      const id = ids[i];
      expect(!id.exists && id.offset === i + 1).true;
    }
    expect(intention.generatedIds === 5).true;
  });

  it('usedOffsets checks which offsets are in use', () => {
    let intention = new Intention();
    const id = intention.createID();
    expect(intention.getUsedOffsets().size).toBe(0);

    intention = intention.addComponent('test', 1, id);
    expect(intention.getUsedOffsets().size).toBe(1);
    expect(intention.getUsedOffsets().has(id.offset)).true;

    intention = intention.addComponent('best', 2, id);
    expect(intention.getUsedOffsets().size).toBe(1);
  });

  it('replaceAllUnborn replaces the specified offsets', () => {
    let intention = new Intention();
    const id = intention.createID();

    intention = intention
      .addComponent('test', 1, id)
      .addComponent('best', 1, id);
    expect(intention.getUsedOffsets().size).toBe(1);

    intention.replaceAllUnborn(1, 69);
    expect(intention.getUsedOffsets().size).toBe(0);
    expect(
      intention.changes.every(change => {
        if (!isComponentChange(change)) return true;
        if (change.id === undefined) return true;
        return hasID(change.id, 69);
      })
    ).true;
  });

  it('replaceAllUnborn leaves unspecified offsets alone', () => {
    let intention = new Intention();
    const id = intention.createID();

    intention = intention
      .addComponent('test', 1, id)
      .addComponent('best', 1, id);
    expect(intention.getUsedOffsets().size).toBe(1);

    intention.replaceAllUnborn(2, 69);
    expect(intention.getUsedOffsets().size).toBe(1);
  });

  it('Adding a new unborn change should preserve its offset', () => {
    const unbornID: UnbornEntity = ID.unborn(5);
    const intention = new Intention().addComponent('best', 1, unbornID);
    const change = intention.changes[0];
    expect(
      isComponentChange(change) &&
        change.id !== undefined &&
        hasOffset(change.id, 5)
    ).true;
    expect(intention.generatedIds).toBe(5);
  });

  it('Merging intentions should preserve ids', () => {
    let intention = new Intention();
    const id = intention.createID();
    intention = intention.addComponent('test', 1, id);

    let otherIntention = new Intention();

    const otherId = otherIntention.createID();
    otherIntention = otherIntention.addComponent('test', 1, otherId);

    const mergedIntention = intention.merge(otherIntention);
    expect(mergedIntention.generatedIds).toBe(2);
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
    expect(intention.changes.length).toBe(2);
    expect(
      intention.changes.every(change => {
        return isComponentChange(change) && hasOffset(change.id!, 1);
      })
    ).true;
    expect(intention.generatedIds === 1).true;
  });

  it('Adding a component without an id should create that id', () => {
    const intention = new Intention().addComponent('test', 1);
    expect(intention.generatedIds).toBe(1);
    const change = intention.changes[0];

    expect(
      isComponentChange(change) &&
        change.id !== undefined &&
        hasOffset(change.id, 1)
    ).true;
  });
});
