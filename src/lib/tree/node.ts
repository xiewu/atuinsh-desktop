import { NodeID, TraversalOrder, DeleteStrategy, ROOT } from "./types";
import Tree, { TreeData } from "./tree";
import { None, Option, Some } from "@binarymuse/ts-stdlib";

export type JSTreeOutput<T> = {
  id: NodeID;
  data: Option<T>;
  children: JSTreeOutput<T>[];
};

export type JSONTreeOutput<T> = {
  id: NodeID;
  data: T | undefined;
  children: JSONTreeOutput<T>[];
};

export default class Node<T extends {}> {
  private _id: NodeID;
  private tree: Tree<T>;

  constructor(id: NodeID, tree: Tree<T>) {
    this._id = id;
    this.tree = tree;
  }

  public toJS(): TreeData<T> {
    return this.tree.toJS();
  }

  public getData(): Option<T> {
    if (this.id() === ROOT) {
      return None;
    }

    return this.tree.getData(this.id() as string);
  }

  public setData(data: T): Node<T> {
    if (this.id() === ROOT) {
      throw new Error("Cannot set data for root node");
    }

    this.tree.setData(this.id() as string, data);

    return this;
  }

  public id(): NodeID {
    return this._id;
  }

  public root(): Node<T> {
    if (this.id() === ROOT) {
      return this;
    }

    return this.parent().unwrap().root();
  }

  public getNode(id: NodeID): Option<Node<T>> {
    if (id === ROOT) {
      return Some(this.root());
    }

    const node = this.tree.getNode(id);
    const isAncestor = node
      .map((n) => n.ancestors())
      .map((anc) => anc.some((a) => a.id() === this.id()));

    if (isAncestor.unwrapOr(false)) {
      return node;
    }

    return None;
  }

  public getJSTree(): JSTreeOutput<T> {
    const children = this.children().map((child) => child.getJSTree());
    return {
      id: this.id(),
      data: this.getData(),
      children,
    };
  }

  public getJSONTree(): JSONTreeOutput<T> {
    const children = this.children().map((child) => child.getJSONTree());
    return {
      id: this.id(),
      data: this.getData().unwrapOr(undefined),
      children,
    };
  }

  public createChild(id: string, index?: number): Node<T> {
    this.tree.createChild(id, this.id(), index);
    return new Node(id, this.tree);
  }

  public children(): Node<T>[] {
    const childIds = this.tree.getChildren(this.id());
    return childIds.map((id) => new Node(id, this.tree));
  }

  public descendants(order: TraversalOrder): Node<T>[] {
    const iter = this.traverse(order);
    iter.next();
    const output = [...iter];
    return output;
  }

  public parent(): Option<Node<T>> {
    if (this.id() === ROOT) {
      return None;
    }

    const parentId = this.tree.getParent(this.id() as string);
    return parentId.map((id) => new Node(id, this.tree));
  }

  public ancestors(): Node<T>[] {
    const output = [];

    let current = this.parent();
    while (current.isSome()) {
      output.push(current.unwrap());
      current = current.unwrap().parent();
    }

    return output;
  }

  public siblings(): Node<T>[] {
    const isDifferentNode = (node: Node<T>) => node.id() !== this.id();

    return this.parent()
      .map((parent) => parent.children().filter(isDifferentNode))
      .unwrapOr([]);
  }

  public traverse(order: TraversalOrder): IterableIterator<Node<T>> {
    return this.tree.traverseStartingAt(this.id(), order);
  }

  public depth(): number {
    return this.ancestors().length;
  }

  public moveTo(parent: Node<T>, index?: number) {
    if (this.id() === ROOT) {
      throw new Error("Cannot move root node");
    }

    this.tree.updateNode(this.id() as string, parent.id(), index);
  }

  public moveBefore(other: Node<T>) {
    this.moveRelative(other, 0);
  }

  public moveAfter(other: Node<T>) {
    this.moveRelative(other, 1);
  }

  public delete(strategy: DeleteStrategy) {
    if (this.id() === ROOT) {
      throw new Error("Cannot delete root node");
    }

    this.tree.deleteNode(this.id() as string, strategy);
  }

  moveRelative(other: Node<T>, offset: number) {
    if (this.id() === ROOT) {
      throw new Error("Cannot move root node");
    }

    if (other.id() === this.id()) {
      throw new Error("Cannot move node before or after itself");
    }

    if (other.id() === ROOT) {
      throw new Error("Cannot move node before or after root");
    }

    const newParent = other.parent().unwrap();
    const siblings = newParent.children();
    const idx = siblings.findIndex((sibling) => sibling.id() === other.id());
    const newIndex = idx + offset;

    this.tree.updateNode(this.id() as string, newParent.id(), newIndex);
  }
}
