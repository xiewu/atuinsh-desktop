import { useCallback, useMemo, useRef, useState } from "react";
import { NodeApi, NodeRendererProps, Tree, TreeApi } from "react-arborist";
import useResizeObserver from "use-resize-observer";
import RunbookTreeRow, { RunbookRowData, RunbookTreeRowProps } from "./TreeView/RunbookTreeRow";
import FolderTreeRow, { FolderRowData, FolderTreeRowProps } from "./TreeView/FolderTreeRow";
import Runbook from "@/state/runbooks/runbook";

export type TreeRowData = FolderRowData | RunbookRowData;

export enum SortBy {
  Name = "name",
  NameAsc = "name_asc",
  Updated = "updated",
  UpdatedAsc = "updated_asc",
}

interface MoveHandlerArgs<T> {
  dragIds: string[];
  dragNodes: NodeApi<T>[];
  parentId: string | null;
  parentNode: NodeApi<T> | null;
  index: number;
}

interface TreeViewProps {
  data: TreeRowData[];
  sortBy: SortBy;
  selectedItemId: string | null;
  runbooksById: Record<string, Runbook>;
  onTreeApiReady: (treeApi: TreeApi<TreeRowData>) => void;
  onActivateItem: (itemId: string) => void;
  onNewFolder: (parentId: string | null) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onMoveItems: (ids: string[], parentId: string | null, index: number) => void;
  onContextMenu: (evt: React.MouseEvent<HTMLDivElement>, itemId: string) => void;
}

export default function TreeView(props: TreeViewProps) {
  const { ref: resizeRef, width } = useResizeObserver();
  const treeRef = useRef<TreeApi<TreeRowData> | null>(null);

  function handleActivate(node: NodeApi<TreeRowData>) {
    props.onActivateItem(node.data.id); // TODO: rename
  }

  function handleSelect(nodes: NodeApi<TreeRowData>[]) {
    const tree = treeRef.current;
    if (!tree) {
      return;
    }

    const depths = new Set(nodes.map((n) => n.level));
    const types = new Set(nodes.map((n) => n.data.type));
    // If we're selecting nodes of different types AND different depths,
    // only select nodes from the same depth as the original selection.
    if (depths.size > 1 && types.size > 1) {
      const selectedNodes = treeRef.current!.selectedNodes;
      const depth = selectedNodes[selectedNodes.length - 1]!.level;
      for (const node of nodes) {
        if (node.level !== depth) {
          tree.deselect(node.data.id);
        }
      }
    }
  }

  const [rowCount, setRowCount] = useState<number | null>(null);

  function handleToggle() {
    setTimeout(() => setRowCount(treeRef.current?.visibleNodes.length || 10));
  }

  function handleMove(args: MoveHandlerArgs<TreeRowData>) {
    const ids = args.dragIds;
    const parentId = args.parentId;
    const index = args.index;

    props.onMoveItems(ids, parentId, index);
  }

  const TreeRow = useMemo(
    () => (innerProps: NodeRendererProps<FolderRowData | RunbookRowData>) => {
      if (innerProps.node.data.type === "folder") {
        const folderProps: FolderTreeRowProps = {
          style: innerProps.style,
          node: innerProps.node as NodeApi<FolderRowData>,
          tree: innerProps.tree as TreeApi<FolderRowData>,
          dragHandle: innerProps.dragHandle,
          preview: innerProps.preview,
          onContextMenu: props.onContextMenu,
        };
        return <FolderTreeRow {...folderProps} />;
      } else {
        const runbookProps: RunbookTreeRowProps = {
          style: innerProps.style,
          node: innerProps.node as NodeApi<RunbookRowData>,
          tree: innerProps.tree as TreeApi<RunbookRowData>,
          dragHandle: innerProps.dragHandle,
          preview: innerProps.preview,
          runbook: props.runbooksById[innerProps.node.data.id],
          onContextMenu: props.onContextMenu,
        };
        return <RunbookTreeRow {...runbookProps} />;
      }
    },
    [props],
  );

  async function handleRename({ id, name }: { id: string; name: string }) {
    props.onRenameFolder(id, name);
  }

  const ref = useCallback((tree?: TreeApi<TreeRowData> | null) => {
    if (tree) {
      treeRef.current = tree;
      props.onTreeApiReady(tree);
      setTimeout(() => setRowCount(treeRef.current?.visibleNodes.length || 10), 25);
    }
  }, []);

  return (
    <div ref={resizeRef} className="w-[98%] m-auto">
      <Tree
        ref={ref}
        data={props.data}
        // By not setting the selection until we know the tree height, we avoid a bug
        // where the tree would sometimes not render the first few rows after trying to
        // scroll to the selected node while the tree was resizing.
        selection={rowCount ? props.selectedItemId ?? undefined : undefined}
        openByDefault={true}
        initialOpenState={{}}
        width={width}
        height={Math.max((rowCount || 10) * 24 + 8, 30)}
        padding={4}
        onActivate={handleActivate}
        onMove={handleMove}
        onSelect={handleSelect}
        onRename={handleRename}
        onToggle={handleToggle}
      >
        {TreeRow}
      </Tree>
    </div>
  );
}
