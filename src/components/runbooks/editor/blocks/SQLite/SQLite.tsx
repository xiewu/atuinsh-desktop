import { DatabaseIcon } from "lucide-react";

import "@glideapps/glide-data-grid/dist/index.css";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";

import { runQuery } from "./query";
import SQL from "../common/SQL";
import { SQLiteBlock } from "@/lib/blocks/sqlite";

interface SQLiteProps {
  isEditable: boolean;
  collapseQuery: boolean;
  sqlite: SQLiteBlock;

  setQuery: (query: string) => void;
  setUri: (uri: string) => void;
  setAutoRefresh: (autoRefresh: number) => void;
  setName: (name: string) => void;
  setCollapseQuery: (collapseQuery: boolean) => void;
}

const SQLite = ({
  sqlite,
  setQuery,
  setUri,
  setAutoRefresh,
  isEditable,
  setName,
  collapseQuery,
  setCollapseQuery,
}: SQLiteProps) => {

  return (
    <SQL
      block={sqlite}
      id={sqlite.id}
      eventName="runbooks.sqlite"
      name={sqlite.name}
      setName={setName}
      query={sqlite.query}
      setQuery={setQuery}
      uri={sqlite.uri}
      setUri={setUri}
      autoRefresh={sqlite.autoRefresh}
      setAutoRefresh={setAutoRefresh}
      runQuery={runQuery}
      isEditable={isEditable}
      collapseQuery={collapseQuery}
      setCollapseQuery={setCollapseQuery}
    />
  );
};

export default createReactBlockSpec(
  {
    type: "sqlite",
    propSchema: {
      name: { default: "SQLite" },
      query: { default: "" },
      uri: { default: "" },
      autoRefresh: { default: 0 },
      collapseQuery: { default: false },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor, code, type }) => {
      const setQuery = (query: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, query: query },
        });
      };

      const setUri = (uri: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, uri: uri },
        });
      };

      const setAutoRefresh = (autoRefresh: number) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, autoRefresh: autoRefresh },
        });
      };

      const setName = (name: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, name: name },
        });
      };

      const setCollapseQuery = (collapseQuery: boolean) => {
        editor.updateBlock(block, {
          props: { ...block.props, collapseQuery: collapseQuery },
        });
      };

      let sqlite = new SQLiteBlock(block.id, block.props.name, block.props.query, block.props.uri, block.props.autoRefresh);

      return (
        <SQLite
          sqlite={sqlite}
          setName={setName}
          setUri={setUri}
          setQuery={setQuery}
          setAutoRefresh={setAutoRefresh}
          isEditable={editor.isEditable}
          collapseQuery={block.props.collapseQuery}
          setCollapseQuery={setCollapseQuery}
        />
      );
    },
  },
);

export const insertSQLite = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
  title: "SQLite",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "sqlite",
    });
  },
  icon: <DatabaseIcon size={18} />,
  group: "Database",
});
