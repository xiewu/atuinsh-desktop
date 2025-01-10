import { useCallback, useEffect, useMemo, useState } from "react";
import track_event from "@/tracking";
import Logger from "@/lib/logger";
const logger = new Logger("Editor", "orange", "orange");
import * as Y from "yjs";

import "./index.css";

import { Spinner } from "@nextui-org/react";

import { BlockNoteEditor, filterSuggestionItems, insertOrUpdateBlock } from "@blocknote/core";

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
import useDebouncedCallback from "@/lib/useDebouncedCallback";

import { insertSQLite } from "@/components/runbooks/editor/blocks/SQLite/SQLite";
import { insertPostgres } from "@/components/runbooks/editor/blocks/Postgres/Postgres";
import { insertClickhouse } from "@/components/runbooks/editor/blocks/Clickhouse/Clickhouse";

import { insertPrometheus } from "@/components/runbooks/editor/blocks/Prometheus/Prometheus";
import { insertEditor } from "@/components/runbooks/editor/blocks/Editor/Editor";

import { AtuinState, useStore } from "@/state/store";
import Runbook from "@/state/runbooks/runbook";
import { insertHttp } from "./blocks/Http/Http";
import { uuidv7 } from "uuidv7";
import { DuplicateBlockItem } from "./ui/DuplicateBlockItem";

import PhoenixProvider, { PresenceUserInfo } from "@/lib/phoenix_provider";
import Snapshot from "@/state/runbooks/snapshot";
import { useMemory } from "@/lib/utils";
import { createBasicEditor, createCollaborativeEditor, schema } from "./create_editor";

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
  snapshot: Snapshot | null;
  editable: boolean;
  onPresenceJoin: (user: PresenceUserInfo) => void;
  onPresenceLeave: (user: PresenceUserInfo) => void;
};

export default function Editor({
  runbook,
  snapshot,
  editable,
  onPresenceJoin,
  onPresenceLeave,
}: EditorProps) {
  const refreshRunbooks = useStore((store: AtuinState) => store.refreshRunbooks);
  const user = useStore((store: AtuinState) => store.user);
  let [editor, setEditor] = useState<BlockNoteEditor | null>(null);
  const lastRunbook = useMemory(runbook);
  const lastEditor = useMemory<BlockNoteEditor>(editor as BlockNoteEditor);

  const yDoc = useMemo(() => {
    let doc = new Y.Doc();
    if (!runbook) {
      return doc;
    }

    if (runbook.ydoc) {
      Y.applyUpdate(doc, runbook.ydoc);
    }

    return doc;
  }, [runbook?.id]);

  const fetchName = (blocks: any[]): string => {
    // Infer the title from the first text block
    for (const block of blocks) {
      if (block.type == "heading" || block.type == "paragraph") {
        if (block.content.length == 0) continue;
        // @ts-ignore
        if (block.content[0].text.length == 0) continue;

        let name = block.content.filter((i: any) => i.type === "text").map((i: any) => i.text);

        // @ts-ignore
        return name.join(" ");
      }
    }

    return "Untitled";
  };

  const onChange = useCallback(
    async (runbookArg: Runbook | undefined, editorArg: BlockNoteEditor) => {
      if (!runbookArg) return;
      if (runbookArg?.id !== lastRunbook.current?.id) {
        logger.warn(
          "Runbook from args not the same as last mounted runbook!",
          runbookArg?.id,
          lastRunbook.current?.id,
        );
        return;
      }
      if (editorArg !== lastEditor.current) {
        logger.warn("Editor passed to onChange is not the current editor. Ignoring change.");
        return;
      }
      if (!editable) return;

      // Not using await so the runbook gets updated immediately
      Runbook.count().then((num) => {
        track_event("runbooks.save", {
          total: num,
        });
      });

      // The runbook object stored in the `lastRunbook` ref will always be
      // the most up-to-date version of the runbook, even if it was modified
      // outside of this component, due to `react-query` keeping it up-to-date.
      const runbook = lastRunbook.current;
      runbook.name = fetchName(editorArg.document);
      if (editor) runbook.content = JSON.stringify(editorArg.document);
      if (yDoc) runbook.ydoc = Y.encodeStateAsUpdate(yDoc);

      await runbook.save();
      refreshRunbooks();
    },
    [editor],
  );

  // When `onChange` changes due to the editor changing, `useDebouncedCallback`
  // will flush any invocations of the current `onChange` before creating a new
  // debounced function.
  const debouncedOnChange = useDebouncedCallback(onChange, 1000);

  useEffect(() => {
    logger.debug("Runbook or snapshot changed:", runbook?.id, snapshot?.id);
    if (!runbook || !yDoc) return undefined;

    let content = snapshot ? JSON.parse(snapshot.content) : JSON.parse(runbook.content || "[]");

    // convert any block of type sql -> sqlite
    for (var i = 0; i < content.length; i++) {
      if (content[i].type == "sql") {
        content[i].type = "sqlite";
      }
    }

    if (snapshot) {
      // We just want a basic, read-only editor with no
      // collaboration support and no YJS document content.

      const editor = createBasicEditor(content);
      setEditor(editor as any);
      return () => setEditor(null);
    }

    // Otherwise, we want a full editor with all the trimmings
    let timer: number | undefined;
    let provider = new PhoenixProvider(runbook.id, yDoc);

    provider.on("presence:join", onPresenceJoin);
    provider.on("presence:leave", onPresenceLeave);

    const editor = createCollaborativeEditor(provider, user);

    provider.once("synced").then(() => {
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
        debouncedOnChange(runbook, editor as any as BlockNoteEditor); // ugh
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
  }, [runbook?.id, snapshot, yDoc]);

  useEffect(() => {
    if (editor) {
      const extension: any = editor.extensions.collaborationCursor;
      if (extension) {
        extension.options.user.name = user.username || "Anonymous";
      }
    }
  }, [editor, user]);

  if (!editor || !runbook || !debouncedOnChange) {
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
          debouncedOnChange(runbook, editor);
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
