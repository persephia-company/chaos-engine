import {describe, test, expect} from 'vitest';
import {
  areDependenciesChanged,
  buildDependencyGraph,
  filterDependencies,
  findDepths,
  hashDependencies,
} from './dependencies';

describe('Dependency filtering', () => {
  const partialNodes = ['a', 'b', 'd'];
  const deps: Record<string, Set<string>> = {
    b: new Set(['a']),
    c: new Set(['a']),
    d: new Set(['b', 'c']),
  };

  test('Immutability', () => {
    filterDependencies(partialNodes, deps);
    expect(Object.entries(deps).length).toBe(3);
  });

  test('Filters dependencies', () => {
    const filteredDeps = filterDependencies(partialNodes, deps);
    expect(Object.entries(filteredDeps).length).toBe(2);
    expect(filteredDeps['b'].has('a')).true;
    expect(filteredDeps['d'].has('c')).false;
    expect(filteredDeps['d'].has('b')).true;
  });
});

describe('Graph construction', () => {
  const nodes = ['a', 'b', 'c', 'd'];
  const partialNodes = nodes.slice(0, 2);
  const deps: Record<string, Set<string>> = {
    b: new Set(['a']),
    d: new Set(['b', 'c']),
  };

  test('Should initialise graph properly', () => {
    const graph = buildDependencyGraph(nodes, deps);
    expect(graph.size()).toBe(4);
  });

  test('Should only include nodes in the node list', () => {
    const graph = buildDependencyGraph(partialNodes, deps);
    expect(graph.size()).toBe(2);
  });
});

describe('Depth testing', () => {
  const nodes = ['a', 'b', 'c', 'd', 'e'];
  const partialNodes = ['a', 'b', 'd', 'e'];
  const deps: Record<string, Set<string>> = {
    b: new Set(['a']),
    c: new Set(['a']),
    d: new Set(['b', 'c']),
    e: new Set(['c']),
  };

  test('Builds depths', () => {
    const depths = findDepths(nodes, deps);

    expect(depths['a']).toBe(0);
    expect(depths['b']).toBe(1);
    expect(depths['c']).toBe(1);
    expect(depths['d']).toBe(2);
    expect(depths['e']).toBe(2);
  });

  test('Depths only take into account the specified nodes', () => {
    const depths = findDepths(partialNodes, deps);

    expect(depths['a']).toBe(0);
    expect(depths['b']).toBe(1);
    expect(depths['c']).toBe(undefined);
    expect(depths['d']).toBe(2);
    expect(depths['e']).toBe(0);
  });
});

describe('Hashing dependencies', () => {
  const nodes = ['a', 'b', 'c', 'd'];
  const deps: Record<string, Set<string>> = {
    b: new Set(['a']),
    d: new Set(['b', 'c']),
  };

  const equivalentDeps: Record<string, Set<string>> = {
    b: new Set(['a']),
    d: new Set(['c', 'b']),
  };

  const changedDeps: Record<string, Set<string>> = {
    b: new Set(['a', 'b']),
    d: new Set(['c', 'b']),
  };

  test('Should not care about set order', () => {
    expect(hashDependencies(nodes, deps)).toBe(
      hashDependencies(nodes, equivalentDeps)
    );
  });

  test('Hashing same dependencies should equal', () => {
    expect(hashDependencies(nodes, deps)).toBe(hashDependencies(nodes, deps));
  });

  test('Should detect changes', () => {
    const hash = hashDependencies(nodes, deps);
    expect(areDependenciesChanged(nodes, deps, hash)).false;
    expect(areDependenciesChanged(nodes, changedDeps, hash)).true;
    expect(areDependenciesChanged(['a'], deps, hash)).true;
  });
});
