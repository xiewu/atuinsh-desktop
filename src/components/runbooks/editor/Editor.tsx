import "./index.css";

import { Spinner } from "@heroui/react";

import { filterSuggestionItems, insertOrUpdateBlock } from "@blocknote/core";

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

import { CodeIcon, FolderOpenIcon, VariableIcon, TextCursorInputIcon } from "lucide-react";

import { insertSQLite } from "@/components/runbooks/editor/blocks/SQLite/SQLite";
import { insertPostgres } from "@/components/runbooks/editor/blocks/Postgres/Postgres";
import { insertClickhouse } from "@/components/runbooks/editor/blocks/Clickhouse/Clickhouse";
import { insertScript } from "@/components/runbooks/editor/blocks/Script/Script";
import { insertPrometheus } from "@/components/runbooks/editor/blocks/Prometheus/Prometheus";
import { insertEditor } from "@/components/runbooks/editor/blocks/Editor/Editor";
import { insertSshConnect } from "@/components/runbooks/editor/blocks/ssh/SshConnect";
import { insertHostSelect } from "@/components/runbooks/editor/blocks/Host";
import { insertLocalVar } from "@/components/runbooks/editor/blocks/LocalVar";

import Runbook from "@/state/runbooks/runbook";
import { insertHttp } from "./blocks/Http/Http";
import { uuidv7 } from "uuidv7";
import { DuplicateBlockItem } from "./ui/DuplicateBlockItem";

import { schema } from "./create_editor";
import RunbookEditor from "@/lib/runbook_editor";
import { useStore } from "@/state/store";
import { usePromise } from "@/lib/utils";
import { useCallback, useEffect, useRef } from "react";
import BlockBus from "@/lib/workflow/block_bus";
import { invoke } from "@tauri-apps/api/core";
import { convertBlocknoteToAtuin } from "@/lib/workflow/blocks/convert";

// Slash menu item to insert an Alert block
const insertTerminal = (editor: typeof schema.BlockNoteEditor) => ({
  title: "Terminal",
  subtext: "Interactive terminal",
  onItemClick: () => {
    // Count the number of terminal blocks
    let terminalBlocks = editor.document.filter((block) => block.type === "run");
    let name = `Terminal ${terminalBlocks.length + 1}`;

    insertOrUpdateBlock(editor, {
      type: "run",
      props: {
        name,
      },
    });
  },
  icon: <CodeIcon size={18} />,
  aliases: ["terminal", "run"],
  group: "Execute",
});

const insertDirectory = (editor: typeof schema.BlockNoteEditor) => ({
  title: "Directory",
  subtext: "Set runbook directory",
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
  title: "Environment Variable",
  subtext: "Set environment variable for all subsequent code blocks",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "env",
    });
  },
  icon: <VariableIcon size={18} />,
  aliases: ["env", "environment", "variable"],
  group: "Execute",
});

const insertVar = (editor: typeof schema.BlockNoteEditor) => ({
  title: "Template Variable",
  subtext: "Set template variable for use in subsequent blocks",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "var",
    });
  },
  icon: <TextCursorInputIcon size={18} />,
  aliases: ["var", "template", "variable"],
  group: "Execute",
});

type EditorProps = {
  runbook: Runbook | null;
  editable: boolean;
  runbookEditor: RunbookEditor;
};

export default function Editor({ runbook, editable, runbookEditor }: EditorProps) {
  const editor = usePromise(runbookEditor.getEditor());
  const colorMode = useStore((state) => state.functionalColorMode);
  const fontSize = useStore((state) => state.fontSize);
  const fontFamily = useStore((state) => state.fontFamily);
  const serialExecuteRef = useRef<(() => void) | null>(null);

  const serialExecuteCallback = useCallback(async () => {
    if (!editor || !runbook) {
      return;
    }

    let workflow = editor.document
      .map(convertBlocknoteToAtuin)
      .filter((block) => block !== null)
      .map((block) => ({ type: block.typeName, ...block.object() }));
    console.log(workflow);
    await invoke("workflow_serial", { id: runbook.id, workflow });
  }, [editor, runbook]);

  useEffect(() => {
    if (!editor || !runbook || serialExecuteRef.current) {
      return;
    }

    serialExecuteRef.current = BlockBus.get().subscribeStartWorkflow(
      runbook.id,
      serialExecuteCallback,
    );

    return () => {
      if (serialExecuteRef.current) {
        BlockBus.get().unsubscribeStartWorkflow(runbook.id, serialExecuteRef.current);
      }
    };
  }, [editor, runbook]);

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
      style={{
        fontSize: `${fontSize}px`,
        fontFamily: fontFamily,
      }}
      onClick={(e) => {
        // Only return if clicking inside editor content, not modals/inputs
        if (
          (e.target as Element).matches(".editor .bn-container *") ||
          (e.target as HTMLElement).tagName === "INPUT"
        )
          return;
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
        theme={colorMode === "dark" ? "dark" : "light"}
        editable={editable}
      >
        <SuggestionMenuController
          triggerCharacter={"/"}
          getItems={async (query: any) =>
            filterSuggestionItems(
              [
                ...getDefaultReactSlashMenuItems(editor),
                // Execute group
                insertTerminal(editor as any),
                insertEnv(editor as any),
                insertVar(editor as any),
                insertLocalVar(schema)(editor),
                insertScript(schema)(editor),
                insertDirectory(editor as any),
                
                // Monitoring group
                insertPrometheus(schema)(editor),
                
                // Database group
                insertSQLite(schema)(editor),
                insertPostgres(schema)(editor),
                insertClickhouse(schema)(editor),
                
                // Network group
                insertHttp(schema)(editor),
                insertSshConnect(schema)(editor),
                insertHostSelect(schema)(editor),
                
                // Misc group
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
