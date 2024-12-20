import { useEffect, useState } from "react";
import track_event from "@/tracking";
import { randomColor } from "@/lib/colors";
import Logger from "@/lib/logger";
const logger = new Logger("Editor", "orange", "orange");

import "./index.css";

import { Spinner } from "@nextui-org/react";

import {
  BlockNoteSchema,
  BlockNoteEditor,
  defaultBlockSpecs,
  filterSuggestionItems,
  insertOrUpdateBlock,
} from "@blocknote/core";

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
import { useDebounceCallback } from "usehooks-ts";

import Run from "@/components/runbooks/editor/blocks/Run";
import Directory from "@/components/runbooks/editor/blocks/Directory";
import Env from "@/components/runbooks/editor/blocks/Env";
import SQLite, { insertSQLite } from "@/components/runbooks/editor/blocks/SQLite/SQLite";
import Postgres, { insertPostgres } from "@/components/runbooks/editor/blocks/Postgres/Postgres";
import Clickhouse, {
  insertClickhouse,
} from "@/components/runbooks/editor/blocks/Clickhouse/Clickhouse";

import Prometheus, {
  insertPrometheus,
} from "@/components/runbooks/editor/blocks/Prometheus/Prometheus";
import CodeEditor, { insertEditor } from "@/components/runbooks/editor/blocks/Editor/Editor";

import { AtuinState, useStore } from "@/state/store";
import Runbook from "@/state/runbooks/runbook";
import Http, { insertHttp } from "./blocks/Http/Http";
import { uuidv7 } from "uuidv7";
import { DuplicateBlockItem } from "./ui/DuplicateBlockItem";

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

type EditorProps = {
  runbook: Runbook | null;
};

export default function Editor(props: EditorProps) {
  const runbook = props.runbook;
  const refreshRunbooks = useStore((store: AtuinState) => store.refreshRunbooks);
  const setCurrentRunbook = useStore((store) => store.setCurrentRunbook);

  const user = useStore((store: AtuinState) => store.user);
  let [editor, setEditor] = useState<BlockNoteEditor | null>(null);

  const fetchName = (editor: BlockNoteEditor): string => {
    // Infer the title from the first text block
    if (!editor) return "Untitled";

    let blocks = editor.document;
    for (const block of blocks) {
      if (block.type == "heading" || block.type == "paragraph") {
        if (block.content.length == 0) continue;
        // @ts-ignore
        if (block.content[0].text.length == 0) continue;

        let name = block.content.filter((i) => i.type === "text").map((i) => i.text);

        // @ts-ignore
        return name.join(" ");
      }
    }

    return "Untitled";
  };

  const onChange = async (editor: BlockNoteEditor) => {
    if (!runbook) return;

    track_event("runbooks.save", {
      total: await Runbook.count(),
    });

    runbook.name = fetchName(editor as BlockNoteEditor);
    if (editor) runbook.content = JSON.stringify(editor.document);

    await runbook.save();
    // update the state so other components refresh
    setCurrentRunbook(runbook, true);
    refreshRunbooks();
  };

  const debouncedOnChange = useDebounceCallback(onChange, 1000);

  useEffect(() => {
    logger.debug("Runbook changed:", runbook);
    if (!runbook) return undefined;

    let content = JSON.parse(runbook.content || "[]");

    // convert any block of type sql -> sqlite
    for (var i = 0; i < content.length; i++) {
      if (content[i].type == "sql") {
        content[i].type = "sqlite";
      }
    }

    let timer: number | undefined;
    let provider = new PhoenixProvider(runbook.id, runbook.ydoc);

    const editor = BlockNoteEditor.create({
      schema,
      collaboration: {
        provider: provider,
        fragment: runbook.ydoc.getXmlFragment("document-store"),
        user: {
          name: user.username || "Anonymous",
          color: randomColor(),
        },
      },
    });

    provider.once("synced", () => {
      // If the loaded YJS doc has no content, and the server has no content,
      // we should take the old `content` field (if any) and populate the editor
      // so that we trigger a save, creating the YJS document.
      //
      // This doesn't work if we set the content on the same tick, so defer it.
      timer = setTimeout(() => {
        timer = undefined;
        let currentContent = editor.document;

        if (isContentBlank(currentContent)) {
          logger.info(
            "BlockNote editor has empty content after sync; inserting existing content.",
            currentContent,
            content,
          );

          editor.replaceBlocks(currentContent, content);
        }
      }, 100);

      setEditor(editor as any);

      (window as any).editor = editor;

      provider.on("remote_update", () => {
        debouncedOnChange(editor as any);
      });
      // provider.start();
    });

    return () => {
      // TODO: do we need to destroy the editor somehow
      if (provider) provider.shutdown();
      if (timer) clearTimeout(timer);
      setEditor(null);
    };
    // zustand state is immutable, so `runbook` will change every runbook.save()
    // to avoid creating a new editor and provider every save, depend on the runbook ID
  }, [runbook?.id]);

  useEffect(() => {
    if (editor) {
      const extension: any = editor.extensions.collaborationCursor;
      if (extension) {
        extension.options.user.name = user.username || "Anonymous";
      }
    }
  }, [editor, user]);

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
        onChange={() => debouncedOnChange(editor)}
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
