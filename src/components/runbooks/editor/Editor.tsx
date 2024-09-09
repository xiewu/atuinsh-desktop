import { useEffect, useMemo, useState } from "react";

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

import Prometheus, {
  insertPrometheus,
} from "@/components/runbooks/editor/blocks/Prometheus/Prometheus";

import { DeleteBlock } from "@/components/runbooks/editor/ui/DeleteBlockButton";
import { AtuinState, useStore } from "@/state/store";
import Runbook from "@/state/runbooks/runbook";
import Http, { insertHttp } from "./blocks/Http/Http";

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

    // Network
    http: Http,
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
  aliases: ["code", "run"],
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

    console.log("saved!");
    runbook.name = fetchName();
    if (editor) runbook.content = JSON.stringify(editor.document);

    await runbook.save();
    refreshRunbooks();
  };

  const debouncedOnChange = useDebounceCallback(onChange, 1000);

  const editor = useMemo(() => {
    if (!runbook) return undefined;
    if (!runbook.content) return BlockNoteEditor.create({ schema });

    let content = JSON.parse(runbook.content);

    // convert any block of type sql -> sqlite
    for (var i = 0; i < content.length; i++) {
      if (content[i].type == "sql") {
        content[i].type = "sqlite";
      }
    }

    return BlockNoteEditor.create({
      initialContent: content,
      schema,
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

  if (editor === undefined) {
    return (
      <div className="flex w-full h-full flex-col justify-center items-center">
        <Spinner />
      </div>
    );
  }

  // Renders the editor instance.
  return (
    <div className="overflow-y-scroll editor flex-grow">
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
                insertHttp(schema)(editor),
              ],
              query,
            )
          }
        />

        <SideMenuController
          sideMenu={(props: any) => (
            <SideMenu {...props}>
              <AddBlockButton {...props} />
              <DeleteBlock {...props} />
            </SideMenu>
          )}
        />
      </BlockNoteView>
    </div>
  );
}
