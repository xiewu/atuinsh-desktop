import CodeEditor from "@/components/runbooks/editor/blocks/Editor/Editor";
import { BlockNoteEditor, BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import Run from "./blocks/Run";
import Directory from "./blocks/Directory";
import Env from "./blocks/Env";
import Prometheus from "./blocks/Prometheus/Prometheus";
import SQLite from "./blocks/SQLite/SQLite";
import Postgres from "./blocks/Postgres/Postgres";
import Clickhouse from "./blocks/Clickhouse/Clickhouse";
import Http from "./blocks/Http/Http";
import { randomColor } from "@/lib/colors";
import PhoenixProvider from "@/lib/phoenix_provider";
import { User } from "@/state/models";
import * as Y from "yjs";

// Our schema with block specs, which contain the configs and implementations for blocks
// that we want our editor to use.
export const schema = BlockNoteSchema.create({
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

export function createBasicEditor(content: any) {
  return BlockNoteEditor.create({
    schema,
    initialContent: content,
  });
}

export function createCollaborativeEditor(
  provider: PhoenixProvider,
  user: User,
  presenceColor?: string,
) {
  presenceColor = presenceColor || randomColor();
  return BlockNoteEditor.create({
    schema,
    _tiptapOptions: {
      editorProps: {
        scrollThreshold: 80,
        scrollMargin: 80,
      },
    },
    collaboration: {
      provider: provider,
      fragment: provider.doc.getXmlFragment("document-store"),
      user: {
        name: user.username || "Anonymous",
        color: presenceColor,
      },
    },
  });
}

export function createConversionEditor(fragment: Y.XmlFragment) {
  return BlockNoteEditor.create({
    schema,
    collaboration: {
      provider: new NullProvider(),
      fragment: fragment,
      user: {
        name: "Conversion",
        color: randomColor(),
      },
    },
  });
}

class NullProvider {
  get awareness() {
    return {
      on: () => () => {}
    }
  }
}
