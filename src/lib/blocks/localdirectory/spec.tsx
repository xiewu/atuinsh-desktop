import { LOCALDIRECTORY_BLOCK_SCHEMA } from "@/lib/blocks/localdirectory";
import { createReactBlockSpec } from "@blocknote/react";
import { LocalDirectoryComponent } from "./component";
import track_event from "@/tracking";
import { FolderIcon } from "lucide-react";

export default createReactBlockSpec(
    LOCALDIRECTORY_BLOCK_SCHEMA,
    {
      // @ts-ignore
      render: ({ block, editor }) => {
        return (
          <LocalDirectoryComponent
            blockId={block.id}
            isEditable={editor.isEditable}
          />
        );
      },
      toExternalHTML: () => {
        return (
          <div>
            <strong>Local Directory:</strong> (stored locally)
          </div>
        );
      },
    },
  );

export const insertLocalDirectory = (editor: any) => ({
  title: "Local Directory",
  subtext: "Set current working directory (local to your machine)",
  onItemClick: () => {
    track_event("runbooks.block.create", { type: "local-directory" });

    editor.insertBlocks(
      [
        {
          type: "local-directory",
          props: {},
        },
      ],
      editor.getTextCursorPosition().block.id,
      "before",
    );
  },
  icon: <FolderIcon size={18} />,
  aliases: ["localdirectory", "localdir", "workdir"],
  group: "Execute",
});
