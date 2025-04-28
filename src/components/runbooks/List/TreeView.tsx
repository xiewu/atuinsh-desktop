import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NodeApi, NodeRendererProps, Tree, TreeApi } from "react-arborist";
import useResizeObserver from "use-resize-observer";
import RunbookTreeRow, { RunbookRowData, RunbookTreeRowProps } from "./TreeView/RunbookTreeRow";
import FolderTreeRow, { FolderRowData, FolderTreeRowProps } from "./TreeView/FolderTreeRow";
import Runbook from "@/state/runbooks/runbook";
import { useDragDropManager } from "react-dnd";

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

interface DragCheckArgs<T> {
  parentNode: NodeApi<T> | null;
  dragNodes: NodeApi<T>[];
  index: number;
}

interface TreeViewProps {
  data: TreeRowData[];
  sortBy: SortBy;
  selectedItemId: string | null;
  runbooksById: Record<string, Runbook>;
  initialOpenState: Record<string, boolean>;
  onTreeApiReady: (treeApi: TreeApi<TreeRowData>) => void;
  onActivateItem: (itemId: string) => void;
  onNewFolder: (parentId: string | null) => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onMoveItems: (ids: string[], parentId: string | null, index: number) => void;
  onContextMenu: (evt: React.MouseEvent<HTMLDivElement>, itemId: string) => void;
  onToggleFolder: (nodeId: string) => void;
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

  function handleToggle(nodeId: string) {
    setTimeout(() => setRowCount(treeRef.current?.visibleNodes.length || 10));
    props.onToggleFolder(nodeId);
  }

  function handleMove(args: MoveHandlerArgs<TreeRowData>) {
    const ids = args.dragIds;
    const parentId = args.parentId;
    const index = args.index;

    props.onMoveItems(ids, parentId, index);
  }

  function checkDisableDrop({ dragNodes }: DragCheckArgs<TreeRowData>) {
    // When dragging nodes over a different tree,
    // `dragNodes` will be empty.
    if (dragNodes.length === 0) {
      return true;
    }
    return false;
  }

  // Hack to allow TreeRow to be memoized, which keeps
  // the inline editor for resetting during sync
  const onContextMenuRef = useRef(props.onContextMenu);
  useEffect(() => {
    onContextMenuRef.current = props.onContextMenu;
  }, [props.onContextMenu]);
  const onContextMenu = useCallback((evt: React.MouseEvent<HTMLDivElement>, itemId: string) => {
    onContextMenuRef.current(evt, itemId);
  }, []);

  const runbooksByIdRef = useRef(props.runbooksById);
  useEffect(() => {
    runbooksByIdRef.current = props.runbooksById;
  }, [props.runbooksById]);
  const getRunbookById = useCallback((id: string) => runbooksByIdRef.current[id], []);

  const TreeRow = useMemo(
    () => (innerProps: NodeRendererProps<FolderRowData | RunbookRowData>) => {
      if (innerProps.node.data.type === "folder") {
        const folderProps: FolderTreeRowProps = {
          style: innerProps.style,
          node: innerProps.node as NodeApi<FolderRowData>,
          tree: innerProps.tree as TreeApi<FolderRowData>,
          dragHandle: innerProps.dragHandle,
          preview: innerProps.preview,
          onContextMenu,
        };
        return <FolderTreeRow key={innerProps.node.data.id} {...folderProps} />;
      } else {
        const runbookProps: RunbookTreeRowProps = {
          style: innerProps.style,
          node: innerProps.node as NodeApi<RunbookRowData>,
          tree: innerProps.tree as TreeApi<RunbookRowData>,
          dragHandle: innerProps.dragHandle,
          preview: innerProps.preview,
          runbook: getRunbookById(innerProps.node.data.id),
          onContextMenu,
        };
        return <RunbookTreeRow key={innerProps.node.data.id} {...runbookProps} />;
      }
    },
    [getRunbookById, onContextMenu],
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

  // See https://github.com/brimdata/react-arborist/issues/230#issuecomment-2404208311
  const dragDropManager = useDragDropManager();

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
        initialOpenState={props.initialOpenState}
        width={width}
        height={Math.max((rowCount || 10) * 24 + 8, 30)}
        padding={4}
        disableDrop={checkDisableDrop}
        onActivate={handleActivate}
        onMove={handleMove}
        onSelect={handleSelect}
        onRename={handleRename}
        onToggle={handleToggle}
        dndManager={dragDropManager}
      >
        {TreeRow}
      </Tree>
    </div>
  );
}
