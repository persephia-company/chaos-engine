import {Queue} from '@datastructures-js/queue';
import {DepGraph} from 'dependency-graph';
import {groupBy, hash_cyrb53} from './util';
import stringify from 'json-stable-stringify';
import * as R from 'ramda';

export const filterDependencies = (
  subset: string[],
  dependencies: Record<string, Set<string>>
): Record<string, Set<string>> => {
  return Object.entries(dependencies).reduce(
    (result, [node, dependencies]) => {
      const isRelevant = (name: string) => subset.some(_name => _name === name);

      if (!isRelevant(node)) {
        return result;
      }
      const filteredDependencies = new Set(
        Array.from(dependencies).filter(isRelevant)
      );
      return {...result, [node]: filteredDependencies};
    },
    {} as Record<string, Set<string>>
  );
};

/**
 * Given a list of nodes, and some dependencies, return a dependency
 * graph which is restricted to the current list of nodes.
 */
export const buildDependencyGraph = (
  nodes: string[],
  dependencies: Record<string, Set<string>>
): DepGraph<string> => {
  const result = new DepGraph<string>();
  dependencies = filterDependencies(nodes, dependencies);

  nodes.forEach(node => result.addNode(node));

  Object.entries(dependencies).forEach(([node, deps]) => {
    deps.forEach(dependency => result.addDependency(node, dependency));
  });

  return result;
};

/**
 * Builds a record describing the "batch depth" of each node.
 *
 * The batch depth can be thought of as an integer, where all
 * nodes of the same batch can be run at the same time, and guarantee
 * no conflicts.
 *
 * Note that the batch depth is filtered to only the appropriate nodes,
 * i.e. in the dependencies record, if a node is solely dependent on another
 * which isn't in the supplied list of nodes, this node is considered a leaf
 * node and has a depth of 0.
 */
export const findDepths = (
  nodes: string[],
  dependencies: Record<string, Set<string>>
): Record<string, number> => {
  const graph = buildDependencyGraph(nodes, dependencies);

  const leafs = nodes.filter(
    node => graph.directDependenciesOf(node).length === 0
  );

  const initialDepths = leafs.map(node => [node, 0]) as [string, number][];

  const q = new Queue(initialDepths);
  const depths: Record<string, number> = {};

  const calculateDepth = (currentDepth: number, node: string) => {
    return Math.max(currentDepth + 1, depths[node] ?? 0);
  };

  while (!q.isEmpty()) {
    const [node, depth] = q.dequeue();
    const neighbours = graph.dependantsOf(node);

    const nextNodes = neighbours.map(neighbour => [
      neighbour,
      calculateDepth(depth, neighbour),
    ]) as [string, number][];
    nextNodes.forEach(v => q.enqueue(v));

    depths[node] = depth;
  }
  return depths;
};

export const batchByDepths = (depths: Record<string, number>): string[][] => {
  const systemsByDepth = groupBy(([_, depth]) => depth, Object.entries(depths));

  const sorted = R.sortBy(
    ([depth, _]) => Number.parseInt(depth),
    Object.entries(systemsByDepth)
  );

  return sorted.map(([_, batches]) => batches.map(([node]) => node));
};

export const hashDependencies = (
  nodes: string[],
  dependencies: Record<string, Set<string>>
): number => {
  const dependencyLists = Object.fromEntries(
    Object.entries(dependencies).map(([node, deps]) => [
      node,
      Array.from(deps.values()).sort((a, b) => a.localeCompare(b)),
    ])
  );
  return hash_cyrb53(stringify({nodes, dependencies: dependencyLists}));
};

export const areDependenciesChanged = (
  nodes: string[],
  dependencies: Record<string, Set<string>>,
  hash: number
): boolean => {
  return hash !== hashDependencies(nodes, dependencies);
};
