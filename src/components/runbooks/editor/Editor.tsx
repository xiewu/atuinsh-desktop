import { useEffect, useMemo, useState } from "react";
import track_event from "@/tracking";
import Logger from "@/lib/logger";
const logger = new Logger("Editor", "orange", "orange");

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

function isContentBlank(content: any) {
  return (
    content.length === 1 &&
    content[0].content.length === 0 &&
    content[0].type === "paragraph" &&
    content[0].id === "initialBlockId"
  );
}

export default function Editor() {
  const runbookId = useStore((store: AtuinState) => store.currentRunbook);
  const refreshRunbooks = useStore(
    (store: AtuinState) => store.refreshRunbooks,
  );
  let [runbook, setRunbook] = useState<Runbook | null>(null);
  let [editor, setEditor] = useState<BlockNoteEditor | null>(null);

  useEffect(() => {
    logger.debug("Getting runbook", runbookId);
    if (!runbookId) return;

    const fetchRunbook = async () => {
      logger.debug("Loading...");
      let rb = await Runbook.load(runbookId);
      logger.debug("Runbook loaded from DB", rb);

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
    logger.debug("Runbook changed:", runbook);
    if (!runbook) return undefined;

    let content = JSON.parse(runbook.content || "[]");
    logger.debug("content", content);

    // convert any block of type sql -> sqlite
    for (var i = 0; i < content.length; i++) {
      if (content[i].type == "sql") {
        content[i].type = "sqlite";
      }
    }

    let provider: PhoenixProvider | null = null;
    let timer: number | undefined;
    getSocket().then((socket) => {
      logger.debug("got socket");
      // TODO: need to determine if we're offline and fallback to local editing if so
      provider = new PhoenixProvider(socket, runbook.id, runbook.ydoc);

      const editor = BlockNoteEditor.create({
        schema,
        collaboration: {
          provider: provider,
          fragment: runbook.ydoc.getXmlFragment("document-store"),
          user: {
            // todo
            name: "Me",
            color: "#ffffff",
          },
        },
      });

      provider.on("synced", () => {
        // If the loaded YJS dot has no content, and the server has no content,
        // we should take the old `content` field (if any) and populate the editor
        // so that we trigger a save, creating the YJS document.
        //
        // This doesn't work if we set the content on the same tick, so defer it
        timer = setTimeout(() => {
          timer = undefined;
          let currentContent = editor.document;
          if (isContentBlank(currentContent)) {
            logger.info(
              "BlockNote editor has empty content after sync; inserting existing content.",
            );
            editor.replaceBlocks(currentContent, content);
          }
        }, 100);

        setEditor(editor as any);
        (window as any).editor = editor;
      });
      provider.start();
    });

    return () => {
      // TODO: do we need to destroy the editor somehow
      if (provider) provider.shutdown();
      if (timer) clearTimeout(timer);
      setEditor(null);
    };
  }, [runbook]);

  const fetchName = (): string => {
    // Infer the title from the first text block
    if (!editor) return "Untitled";

    let blocks = editor.document;
    for (const block of blocks) {
      if (block.type == "heading" || block.type == "paragraph") {
        if (block.content.length == 0) continue;
        // @ts-ignore
        if (block.content[0].text.length == 0) continue;

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

  if (!editor) {
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
