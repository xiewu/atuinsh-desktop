import { describe, expect, test } from "vitest";
import { DeleteStrategy, ROOT, TraversalOrder, Tree } from ".";
import { None } from "@binarymuse/ts-stdlib";

type TestTreeData = number;

describe("Tree", () => {
  test("has default structure", () => {
    const root = Tree.empty<TestTreeData>();
    const tree = root.getJSONTree();

    expect(tree).toEqual({
      id: ROOT,
      data: undefined,
      children: [],
    });
  });

  test("can iterate over a tree in DFS order", () => {
    const root = Tree.empty<TestTreeData>();
    const child1 = root.createChild("child1").setData(1);
    // @ts-ignore
    const child2 = root.createChild("child2").setData(2);
    // @ts-ignore
    const child3 = child1.createChild("child3").setData(3);
    // @ts-ignore
    const child4 = child1.createChild("child4").setData(4);

    const dfs = root.traverse(TraversalOrder.DepthFirst);
    const items = [...dfs].map((node) => ({
      id: node.id(),
      data: node.getData().unwrapOr(undefined),
    }));
    expect(items).toEqual([
      { id: ROOT, data: undefined },
      { id: "child1", data: 1 },
      { id: "child3", data: 3 },
      { id: "child4", data: 4 },
      { id: "child2", data: 2 },
    ]);
  });

  test("can iterate over a tree in BFS order", () => {
    const root = Tree.empty<TestTreeData>();
    const child1 = root.createChild("child1").setData(1);
    // @ts-ignore
    const child2 = root.createChild("child2").setData(2);
    // @ts-ignore
    const child3 = child1.createChild("child3").setData(3);
    // @ts-ignore
    const child4 = child1.createChild("child4").setData(4);

    const bfs = root.traverse(TraversalOrder.BreadthFirst);
    const items = [...bfs].map((node) => ({
      id: node.id(),
      data: node.getData().unwrapOr(undefined),
    }));
    expect(items).toEqual([
      { id: ROOT, data: undefined },
      { id: "child1", data: 1 },
      { id: "child2", data: 2 },
      { id: "child3", data: 3 },
      { id: "child4", data: 4 },
    ]);
  });

  test("can build a JSON-compatible tree", () => {
    const root = Tree.empty<TestTreeData>();
    const child1 = root.createChild("child1").setData(1);
    const child2 = root.createChild("child2").setData(2);
    // @ts-ignore
    const child3 = child1.createChild("child3").setData(3);
    // @ts-ignore
    const child4 = child1.createChild("child4").setData(4);
    // @ts-ignore
    const child5 = child2.createChild("child5").setData(5);

    const tree = root.getJSONTree();

    expect(tree).toEqual({
      id: ROOT,
      data: undefined,
      children: [
        {
          id: "child1",
          data: 1,
          children: [
            {
              id: "child3",
              data: 3,
              children: [],
            },
            {
              id: "child4",
              data: 4,
              children: [],
            },
          ],
        },
        {
          id: "child2",
          data: 2,
          children: [
            {
              id: "child5",
              data: 5,
              children: [],
            },
          ],
        },
      ],
    });
  });

  test("can get siblings", () => {
    const root = Tree.empty<TestTreeData>();
    const child1 = root.createChild("child1").setData(1);
    const child2 = root.createChild("child2").setData(2);
    const child3 = root.createChild("child3").setData(3);

    const siblings = child1.siblings();
    expect(siblings).toEqual([child2, child3]);
  });

  test("can get descendants in DFS order", () => {
    const root = Tree.empty<TestTreeData>();
    const child1 = root.createChild("child1").setData(1);
    const child2 = child1.createChild("child2").setData(2);
    const child3 = child1.createChild("child3").setData(3);
    const child4 = child2.createChild("child4").setData(4);

    const descendants = child1.descendants(TraversalOrder.DepthFirst);
    expect(descendants).toEqual([child2, child4, child3]);
  });

  test("can get descendants in BFS order", () => {
    const root = Tree.empty<TestTreeData>();
    const child1 = root.createChild("child1").setData(1);
    const child2 = child1.createChild("child2").setData(2);
    const child3 = child1.createChild("child3").setData(3);
    const child4 = child2.createChild("child4").setData(4);

    const descendants = child1.descendants(TraversalOrder.BreadthFirst);
    expect(descendants).toEqual([child2, child3, child4]);
  });

  test("can find root", () => {
    const root = Tree.empty<TestTreeData>();
    const child1 = root.createChild("child1").setData(1);
    const child2 = child1.createChild("child2").setData(2);
    // @ts-ignore
    const child3 = child2.createChild("child3").setData(3);

    expect(child1.root()).toEqual(root);
    expect(child2.root()).toEqual(root);
  });

  test("can get any descendant node by ID", () => {
    const root = Tree.empty<TestTreeData>();
    const child1 = root.createChild("child1").setData(1);
    const child2 = child1.createChild("child2").setData(2);
    const child3 = child2.createChild("child3").setData(3);

    let node = root.getNode("child3");
    expect(node.unwrap()).toEqual(child3);

    node = child2.getNode("child3");
    expect(node.unwrap()).toEqual(child3);

    node = child3.getNode("child1");
    expect(node).toEqual(None);

    node = child3.root().getNode("child1");
    expect(node.unwrap()).toEqual(child1);
  });

  test("can get depth", () => {
    const root = Tree.empty<TestTreeData>();
    const child1 = root.createChild("child1").setData(1);
    const child2 = child1.createChild("child2").setData(2);
    const child3 = child2.createChild("child3").setData(3);

    expect(root.depth()).toEqual(0);
    expect(child1.depth()).toEqual(1);
    expect(child2.depth()).toEqual(2);
    expect(child3.depth()).toEqual(3);
  });

  test("can move nodes", () => {
    const root = Tree.empty<TestTreeData>();
    const child1 = root.createChild("child1").setData(1);
    const child2 = root.createChild("child2").setData(2);
    const child3 = root.createChild("child3").setData(3);

    child1.moveTo(child2);
    expect(child1.parent().unwrap()).toEqual(child2);
    expect(child2.children()).toEqual([child1]);

    child1.moveBefore(child3);
    expect(child1.parent().unwrap()).toEqual(root);
    expect(root.children()).toEqual([child2, child1, child3]);

    child1.moveAfter(child3);
    expect(child1.parent().unwrap()).toEqual(root);
    expect(root.children()).toEqual([child2, child3, child1]);
  });

  describe("deleting nodes", () => {
    test("can delete a node with no children", () => {
      const root = Tree.empty<TestTreeData>();
      const child1 = root.createChild("child1").setData(1);
      const child2 = root.createChild("child2").setData(2);
      const child3 = root.createChild("child3").setData(3);

      child1.delete(DeleteStrategy.Decline);

      expect(root.children()).toEqual([child2, child3]);
    });

    test("refuses to delete a node with children when using Decline strategy", () => {
      const root = Tree.empty<TestTreeData>();
      const child1 = root.createChild("child1").setData(1);
      // @ts-ignore
      const child2 = child1.createChild("child2").setData(2);

      expect(() => child1.delete(DeleteStrategy.Decline)).toThrow();
    });

    test("recursively deletes a node with children when using Cascade strategy", () => {
      const root = Tree.empty<TestTreeData>();
      const child1 = root.createChild("child1").setData(1);
      const child2 = child1.createChild("child2").setData(2);
      // @ts-ignore
      const child3 = child2.createChild("child3").setData(3);

      child2.delete(DeleteStrategy.Cascade);

      expect(root.descendants(TraversalOrder.DepthFirst)).toEqual([child1]);
    });

    test("reattaches children to the parent of the deleted node when using Reattach strategy", () => {
      const root = Tree.empty<TestTreeData>();
      const child1 = root.createChild("child1").setData(1);
      const child2 = child1.createChild("child2").setData(2);
      const child3 = child1.createChild("child3").setData(3);

      child1.delete(DeleteStrategy.Reattach);

      expect(root.children()).toEqual([child2, child3]);
    });
  });
});
