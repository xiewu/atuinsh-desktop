import { DeleteStrategy, NodeID, ROOT, TraversalOrder } from "./types";
import Node from "./node";
import { None, Some, Option, Deque } from "@binarymuse/ts-stdlib";

function makeOption<T>(value: T | null | undefined): Option<T> {
  if (value === null || value === undefined) {
    return None;
  }

  return Some<T>(value);
}

export type TreeData<T> = {
  [key: string]: {
    id: string;
    data: T | null;
    parent: string | null;
    index: number;
  };
};

type InternalData<T> = {
  [key: string]: {
    id: string;
    data: Option<T>;
    parent: Option<string>;
    index: number;
  };
};

export default class Tree<T extends {}> {
  public static empty<T extends {}>(): Node<T> {
    return new Node(ROOT, new Tree({}));
  }

  public static fromJS<T extends {}>(data: TreeData<T>): Node<T> {
    const tree = new Tree<T>(data);
    return new Node(ROOT, tree);
  }

  private data: InternalData<T>;

  private constructor(data: TreeData<T>) {
    this.data = Object.fromEntries(
      Object.entries(data).map(([id, node]) => [
        id,
        {
          ...node,
          parent: makeOption(node.parent),
          data: makeOption(node.data),
        },
      ]),
    );
  }

  public toJS(): TreeData<T> {
    const output: TreeData<T> = {};

    for (const [id, node] of Object.entries(this.data)) {
      output[id] = {
        id,
        data: node.data.isSome() ? node.data.unwrap() : null,
        parent: node.parent.isSome() ? node.parent.unwrap() : null,
        index: node.index,
      };
    }

    return output;
  }

  public getData(id: string): Option<T> {
    return this.data[id]?.data;
  }

  public setData(id: string, data: T) {
    this.data[id].data = Some(data);
  }

  public getNode(id: NodeID): Option<Node<T>> {
    if (id === ROOT) {
      return Some(new Node(ROOT, this));
    }

    if (!this.data[id]) {
      return None;
    }

    return Some(new Node(id, this));
  }

  public getParent(id: NodeID): Option<NodeID> {
    if (id === ROOT) {
      return None;
    }

    const parent = this.data[id]?.parent.unwrapOr(ROOT);
    return Some(parent);
  }

  public getChildren(id: NodeID): NodeID[] {
    if (id === ROOT) {
      return Object.values(this.data)
        .filter((node) => node.parent.isNone())
        .sort((a, b) => a.index - b.index)
        .map((node) => node.id);
    }

    return Object.values(this.data)
      .filter((node) => node.parent.map((parent) => parent === id).unwrapOr(false))
      .sort((a, b) => a.index - b.index)
      .map((node) => node.id);
  }

  public traverseStartingAt(id: NodeID, order: TraversalOrder): IterableIterator<Node<T>> {
    return new TreeTraverser(this, id, order);
  }

  public createChild(id: string, parent: NodeID, index?: number) {
    const siblings = this.getChildren(parent);
    index = index ?? siblings.length;
    if (index > siblings.length) {
      index = siblings.length;
    }
    siblings
      .map((child) => this.data[child as string])
      .filter((child) => child.index >= index)
      .forEach((child) => child.index++);

    const parentOpt = parent === ROOT ? None : Some(parent);
    this.data[id] = { id, data: None, parent: parentOpt, index };
  }

  public updateNode(id: string, parent: NodeID, index?: number) {
    if (!this.data[id]) {
      throw new Error(`Node not found: ${id}`);
    }

    const oldParent = this.data[id].parent.unwrapOr(ROOT);
    const oldSiblings = this.getChildren(oldParent).filter((sibling) => sibling !== id);
    const oldIndex = this.data[id].index;
    oldSiblings
      .filter((sibling) => this.data[sibling as string].index > oldIndex)
      .forEach((sibling) => this.data[sibling as string].index--);

    const siblings = this.getChildren(parent);
    index = index ?? siblings.length;
    siblings
      .map((child) => this.data[child as string])
      .filter((child) => child.index >= index)
      .forEach((child) => child.index++);

    const parentVal = parent === ROOT ? None : Some(parent);
    this.data[id] = { ...this.data[id], parent: parentVal, index };
  }

  public deleteNode(id: string, strategy: DeleteStrategy) {
    const children = this.getChildren(id);

    if (strategy === DeleteStrategy.Decline && children.length > 0) {
      throw new Error("Cannot delete node with children");
    } else if (strategy === DeleteStrategy.Cascade) {
      for (const child of children) {
        this.deleteNode(child as string, strategy);
      }
    } else if (strategy === DeleteStrategy.Reattach) {
      const parent = this.getParent(id).unwrap();
      for (const child of children) {
        this.updateNode(child as string, parent);
      }
    }
    delete this.data[id];
  }
}

export class TreeTraverser<T extends {}> implements IterableIterator<Node<T>> {
  private tree: Tree<T>;
  private start: NodeID;
  private order: TraversalOrder;
  private queue: Deque<NodeID> = new Deque();
  private lastNode: Option<NodeID> = None;

  constructor(tree: Tree<T>, start: NodeID, order: TraversalOrder) {
    this.tree = tree;
    this.start = start;
    this.order = order;

    if (order === TraversalOrder.BreadthFirst) {
      this.queue.pushBack(start);
    }
  }

  public [Symbol.iterator](): IterableIterator<Node<T>> {
    return this;
  }

  public next(): IteratorResult<Node<T>> {
    const next = this.getNext();
    if (next.isNone()) {
      return { done: true, value: undefined };
    }

    const node = new Node(next.unwrap(), this.tree);
    return { done: false, value: node };
  }

  private getNext(): Option<NodeID> {
    if (this.order === TraversalOrder.BreadthFirst) {
      return this.getNextBFS();
    } else {
      return this.getNextDFS();
    }
  }

  private getNextBFS(): Option<NodeID> {
    const currentId = this.queue.popFront();
    if (currentId.isNone()) {
      return None;
    }

    const children = this.tree.getChildren(currentId.unwrap());
    for (const child of children) {
      this.queue.pushBack(child);
    }

    return Some(currentId.unwrap());
  }

  private getNextDFS(): Option<NodeID> {
    if (this.lastNode.isNone()) {
      this.lastNode = Some(this.start);
      return Some(this.start);
    } else {
      const children = this.tree.getChildren(this.lastNode.unwrap());

      if (children.length > 0) {
        const nextId = children[0];
        this.lastNode = Some(nextId);
        return Some(nextId);
      } else {
        // Backtrack to find next sibling
        let currentId = this.lastNode.unwrap();
        while (true) {
          if (currentId === this.start) {
            return None;
          }

          const parentId = this.tree.getParent(currentId);
          if (parentId.isNone()) {
            return None;
          }
          const siblings = this.tree.getChildren(parentId.unwrap());
          const index = siblings.indexOf(currentId);

          if (index + 1 < siblings.length) {
            const nextId = siblings[index + 1];
            this.lastNode = Some(nextId);
            return Some(nextId);
          }

          currentId = parentId.unwrap();
        }
      }
    }
  }
}
