import { useEffect, useMemo, useState } from "react";
import track_event from "@/tracking";

import "./index.css";

import { Spinner } from "@nextui-org/react";

// Errors, but it all works fine and is there. Maybe missing ts defs?
// I'll figure it out later
import {
  // @ts-ignore
  BlockNoteSchema,
  // @ts-ignore
  BlockNoteEditor,
  // @ts-ignore
  defaultBlockSpecs,
  // @ts-ignore
  filterSuggestionItems,
  // @ts-ignore
  insertOrUpdateBlock,
} from "@blocknote/core";

import {
  //@ts-ignore
  SuggestionMenuController,
  // @ts-ignore
  AddBlockButton,
  // @ts-ignore
  getDefaultReactSlashMenuItems,
  // @ts-ignore
  SideMenu,
  // @ts-ignore
  SideMenuController,
  DragHandleMenu,
  RemoveBlockItem,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { CodeIcon, FolderOpenIcon, VariableIcon } from "lucide-react";
import { useDebounceCallback } from "usehooks-ts";

import Run from "@/components/runbooks/editor/blocks/Run";
import Directory from "@/components/runbooks/editor/blocks/Directory";
import Env from "@/components/runbooks/editor/blocks/Env";
import SQLite, {
  insertSQLite,
} from "@/components/runbooks/editor/blocks/SQLite/SQLite";
import Postgres, {
  insertPostgres,
} from "@/components/runbooks/editor/blocks/Postgres/Postgres";
import Clickhouse, {
  insertClickhouse,
} from "@/components/runbooks/editor/blocks/Clickhouse/Clickhouse";

import Prometheus, {
  insertPrometheus,
} from "@/components/runbooks/editor/blocks/Prometheus/Prometheus";
import CodeEditor, {
  insertEditor,
} from "@/components/runbooks/editor/blocks/Editor/Editor";

import { AtuinState, useStore } from "@/state/store";
import Runbook from "@/state/runbooks/runbook";
import Http, { insertHttp } from "./blocks/Http/Http";
import { uuidv7 } from "uuidv7";
import * as Y from "yjs";
import { DuplicateBlockItem } from "./ui/DuplicateBlockItem";

import { getSocket } from "@/socket";
import PhoenixProvider from "@/lib/phoenix_provider";

// Our schema with block specs, which contain the configs and implementations for blocks
// that we want our editor to use.
const schema = BlockNoteSchema.create({
  blockSpecs: {
    // Adds all default blocks.
    ...defaultBlockSpecs,

    // Execution
    run: Run,
    directory: Directory,
    env: Env,

    // Monitoring
    prometheus: Prometheus,

    // Databases
    sqlite: SQLite,
    postgres: Postgres,
    clickhouse: Clickhouse,

    // Network
    http: Http,

    // Misc
    editor: CodeEditor,
  },
});

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

export default function Editor() {
  const runbookId = useStore((store: AtuinState) => store.currentRunbook);
  const refreshRunbooks = useStore(
    (store: AtuinState) => store.refreshRunbooks,
  );
  let [runbook, setRunbook] = useState<Runbook | null>(null);
  let [editor, setEditor] = useState<BlockNoteEditor | null>(null);

  useEffect(() => {
    if (!runbookId) return;

    const fetchRunbook = async () => {
      let rb = await Runbook.load(runbookId);

      setRunbook(rb);
    };

    fetchRunbook();
  }, [runbookId]);

  const onChange = async () => {
    if (!runbook) return;

    track_event("runbooks.save", {
      total: await Runbook.count(),
    });

    runbook.name = fetchName();
    if (editor) runbook.content = JSON.stringify(editor.document);

    await runbook.save();
    refreshRunbooks();
  };

  const debouncedOnChange = useDebounceCallback(onChange, 1000);

  useEffect(() => {
    if (!runbook) return undefined;
    if (!runbook.content) {
      const editor = BlockNoteEditor.create({ schema });
      setEditor(editor as any); // ugh
    }

    let content = JSON.parse(runbook.content);

    // convert any block of type sql -> sqlite
    for (var i = 0; i < content.length; i++) {
      if (content[i].type == "sql") {
        content[i].type = "sqlite";
      }
    }

    getSocket().then((socket) => {
      const doc = new Y.Doc();
      const provider = new PhoenixProvider(socket, runbook.id, doc);
      const fragment = doc.getXmlFragment("document-store");

      const editor = BlockNoteEditor.create({
        initialContent: content,
        schema,
        collaboration: {
          provider: provider,
          fragment: fragment,
          user: {
            // todo
            name: "Me",
            color: "#ffffff",
          },
        },
      });

      provider.on("synced", () => {
        // Now that we know that the document is up to date with the server,
        // we can convert any old "content" data to YJS by inserting it
        // into the editor.
        //
        // TODO
        //
        setEditor(editor as any); // UGH
      });
    });
  }, [runbook]);

  const fetchName = (): string => {
    // Infer the title from the first text block
    if (!editor) return "Untitled";

    let blocks = editor.document;
    for (const block of blocks) {
      if (block.type == "heading" || block.type == "paragraph") {
        if (block.content.length == 0) continue;
        // @ts-ignore
        if (block.content[0].text.length == 0) continae;

        let name = block.content
          .filter((i) => i.type === "text")
          .map((i) => i.text);

        // @ts-ignore
        return name.join(" ");
      }
    }

    return "Untitled";
  };

  if (!runbook) {
    return (
      <div className="flex w-full h-full flex-col justify-center items-center">
        <Spinner />
      </div>
    );
  }

  if (editor === null) {
    return (
      <div className="flex w-full h-full flex-col justify-center items-center">
        <Spinner />
      </div>
    );
  }

  // Renders the editor instance.
  return (
    <div
      className="overflow-y-scroll editor flex-grow"
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
        onChange={debouncedOnChange}
        theme="light"
      >
        <SuggestionMenuController
          triggerCharacter={"/"}
          getItems={async (query: any) =>
            filterSuggestionItems(
              [
                ...getDefaultReactSlashMenuItems(editor),
                insertRun(editor),
                insertDirectory(editor),
                insertEnv(editor),
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
