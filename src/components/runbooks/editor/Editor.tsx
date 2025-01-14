import { useEffect, useState } from "react";

import "./index.css";

import { Spinner } from "@nextui-org/react";

import { filterSuggestionItems, insertOrUpdateBlock } from "@blocknote/core";

function usePromise<T>(promise: Promise<T>) {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    promise.then(setValue);
  }, [promise]);

  return value;
}

import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  SideMenu,
  SideMenuController,
  DragHandleMenu,
  RemoveBlockItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { CodeIcon, FolderOpenIcon, VariableIcon } from "lucide-react";

import { insertSQLite } from "@/components/runbooks/editor/blocks/SQLite/SQLite";
import { insertPostgres } from "@/components/runbooks/editor/blocks/Postgres/Postgres";
import { insertClickhouse } from "@/components/runbooks/editor/blocks/Clickhouse/Clickhouse";

import { insertPrometheus } from "@/components/runbooks/editor/blocks/Prometheus/Prometheus";
import { insertEditor } from "@/components/runbooks/editor/blocks/Editor/Editor";

import Runbook from "@/state/runbooks/runbook";
import { insertHttp } from "./blocks/Http/Http";
import { uuidv7 } from "uuidv7";
import { DuplicateBlockItem } from "./ui/DuplicateBlockItem";

import { schema } from "./create_editor";
import RunbookEditor from "@/lib/runbook_editor";

// Slash menu item to insert an Alert block
const insertRun = (editor: typeof schema.BlockNoteEditor) => ({
  title: "Script",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "run",
    });
  },
  icon: <CodeIcon size={18} />,
  aliases: ["terminal", "run"],
  group: "Execute",
});

const insertDirectory = (editor: typeof schema.BlockNoteEditor) => ({
  title: "Directory",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "directory",
    });
  },
  icon: <FolderOpenIcon size={18} />,
  aliases: ["directory", "dir", "folder"],
  group: "Execute",
});

const insertEnv = (editor: typeof schema.BlockNoteEditor) => ({
  title: "Env",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "env",
    });
  },
  icon: <VariableIcon size={18} />,
  aliases: ["var", "envvar", "export"],
  group: "Execute",
});

type EditorProps = {
  runbook: Runbook | null;
  editable: boolean;
  runbookEditor: RunbookEditor;
};

export default function Editor({ runbook, editable, runbookEditor }: EditorProps) {
  const editor = usePromise(runbookEditor.getEditor());

  if (!editor || !runbook) {
    return (
      <div className="flex w-full h-full flex-col justify-center items-center">
        <Spinner />
      </div>
    );
  }

  // Renders the editor instance.
  return (
    <div
      className="overflow-y-scroll editor flex-grow pt-3"
      onClick={(e) => {
        if ((e.target as Element).matches(".editor *")) return;
        // If the user clicks below the document, focus on the last block
        // But if the last block is not an empty paragraph, create it :D
        let blocks = editor.document;
        let lastBlock = blocks[blocks.length - 1];
        let id = lastBlock.id;
        if (lastBlock.type !== "paragraph" || lastBlock.content.length > 0) {
          id = uuidv7();
          editor.insertBlocks(
            [
              {
                id,
                type: "paragraph",
                content: "",
              },
            ],
            lastBlock.id,
            "after",
          );
        }
        editor.focus();
        editor.setTextCursorPosition(id, "start");
      }}
    >
      <BlockNoteView
        editor={editor}
        slashMenu={false}
        sideMenu={false}
        onChange={() => {
          runbookEditor.save(runbook, editor);
        }}
        theme="light"
        editable={editable}
      >
        <SuggestionMenuController
          triggerCharacter={"/"}
          getItems={async (query: any) =>
            filterSuggestionItems(
              [
                ...getDefaultReactSlashMenuItems(editor),
                insertRun(editor as any),
                insertDirectory(editor as any),
                insertEnv(editor as any),
                insertPrometheus(schema)(editor),
                insertSQLite(schema)(editor),
                insertPostgres(schema)(editor),
                insertClickhouse(schema)(editor),
                insertHttp(schema)(editor),
                insertEditor(schema)(editor),
              ],
              query,
            )
          }
        />

        <SideMenuController
          sideMenu={(props: any) => (
            <SideMenu
              {...props}
              style={{ zIndex: 0 }}
              dragHandleMenu={(props) => (
                <DragHandleMenu {...props}>
                  <RemoveBlockItem {...props}>Delete</RemoveBlockItem>
                  <DuplicateBlockItem {...props} />
                </DragHandleMenu>
              )}
            ></SideMenu>
          )}
        />
      </BlockNoteView>
    </div>
  );
}
