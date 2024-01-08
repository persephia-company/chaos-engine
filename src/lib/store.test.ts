import {SparseComponentStore} from './store';
import {describe, test, expect} from 'vitest';

const expectEmptyStore = <T>(store: SparseComponentStore<T>) => {
  expect(store.length()).toBe(0);
  expect(store.getItems().length).toBe(0);
  expect(store.getComponents().length).toBe(0);
};

const expectSingleComponentStore = <T>(
  store: SparseComponentStore<T>,
  id: number,
  value: T
) => {
  expect(store.length()).toBe(1);
  expect(store.getComponent(id)).toBe(value);
  expect(store.getComponents().length).toBe(1);
  expect(store.getItems().length).toBe(1);
  expect(store.getItems()[0]).toEqual([id, value]);
};

describe('Test New Component Storage', () => {
  test('Should initialise attributes properly', () => {
    const store = new SparseComponentStore();
    expect(store.n).toBe(0);
    expect(store.components.length).toBe(0);
    expect(store.sparse.length).toBe(0);
    expect(store.dense.length).toBe(0);
    expect(store.maxID).greaterThan(0);
  });

  test('Should return empty results after initialisation', () => {
    const store = new SparseComponentStore();
    expectEmptyStore(store);
  });

  test('Getting a non-existing id should return undefined', () => {
    const store = new SparseComponentStore();
    expect(store.getComponent(1)).toBeUndefined();
  });
});

describe('Test non-empty Component Storage', () => {
  test('Test adding a single component', () => {
    const store = new SparseComponentStore<string>();
    store.insert(1, 'hi');
    expectSingleComponentStore(store, 1, 'hi');
  });

  test("Test removing a component that doesn't exist", () => {
    const store = new SparseComponentStore<string>();
    store.insert(1, 'hi');
    store.remove(2);
    expectSingleComponentStore(store, 1, 'hi');
  });

  test('Test inserting a component that already exists', () => {
    let store = new SparseComponentStore<string>();
    store = store.insert(1, 'hi');
    store = store.insert(1, 'bye');
    expectSingleComponentStore(store, 1, 'bye');
  });

  test("Add works and doesn't overwrite", () => {
    let store = new SparseComponentStore<string>();
    store = store.add([], 'hi', 1);
    expectSingleComponentStore(store, 1, 'hi');

    // Shouldn't overwrite
    store = store.add([], 'bye', 1);
    expectSingleComponentStore(store, 1, 'hi');
  });

  test('Set works and overwrites', () => {
    let store = new SparseComponentStore<string>();
    store = store.set([], 'hi', 1);
    expectSingleComponentStore(store, 1, 'hi');

    // Shouldn't overwrite
    store = store.set([], 'bye', 1);
    expectSingleComponentStore(store, 1, 'bye');
  });

  test('Delete works', () => {
    let store = new SparseComponentStore<string>();
    store = store.add([], 'hi', 1);
    expectSingleComponentStore(store, 1, 'hi');

    // Delete many
    store = store.add([], ['this', 'is', 'nice'], [2, 3, 4]);
    store = store.delete([], undefined, [2, 3, 4]);

    // Delete one
    store = store.delete([], undefined, 1);
    expectEmptyStore(store);
  });

  test('Update works', () => {
    let store = new SparseComponentStore<string>();
    store = store.add([], 'hi', 1);
    expectSingleComponentStore(store, 1, 'hi');

    // Should overwrite
    store = store.update([], text => text.toUpperCase(), 1);
    expectSingleComponentStore(store, 1, 'HI');
  });
});
