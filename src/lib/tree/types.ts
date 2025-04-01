export const ROOT = Symbol("ROOT");

export type NodeID = string | typeof ROOT;

export enum TraversalOrder {
  DepthFirst = "depth-first",
  BreadthFirst = "breadth-first",
}

export enum DeleteStrategy {
  Cascade = "cascade",
  Reattach = "reattach",
  Decline = "decline",
}
