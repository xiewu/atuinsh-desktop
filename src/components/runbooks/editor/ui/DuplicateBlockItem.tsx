import {
  DragHandleMenuProps,
  useBlockNoteEditor,
  useComponentsContext,
} from "@blocknote/react";
import { uuidv7 } from "uuidv7";

export function DuplicateBlockItem(props: DragHandleMenuProps) {
  const editor = useBlockNoteEditor();

  const Components = useComponentsContext()!;

  return (
    <Components.Generic.Menu.Item
      onClick={() => {
        let block = structuredClone(props.block);
        let id = uuidv7();
        block.id = id;

        editor.insertBlocks([block

        ], props.block.id, "after");
      }}>
      Duplicate
    </Components.Generic.Menu.Item>
  );
}

