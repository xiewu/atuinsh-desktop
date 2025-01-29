import { DatabaseIcon } from "lucide-react";

import "@glideapps/glide-data-grid/dist/index.css";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";

import { runQuery } from "./query";
import SQL from "../common/SQL";

interface SQLiteProps {
  id: string;
  uri: string;
  query: string;
  autoRefresh: number;
  isEditable: boolean;
  name: string;
  collapseQuery: boolean;

  setQuery: (query: string) => void;
  setUri: (uri: string) => void;
  setAutoRefresh: (autoRefresh: number) => void;
  setName: (name: string) => void;
  setCollapseQuery: (collapseQuery: boolean) => void;
}

const SQLite = ({
  id,
  query,
  setQuery,
  uri,
  setUri,
  autoRefresh,
  setAutoRefresh,
  isEditable,
  name,
  setName,
  collapseQuery,
  setCollapseQuery,
}: SQLiteProps) => {

  return (
    <SQL
      id={id}
      eventName="runbooks.sqlite"
      name={name}
      setName={setName}
      query={query}
      setQuery={setQuery}
      uri={uri}
      setUri={setUri}
      autoRefresh={autoRefresh}
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

      return (
        <SQLite
          id={block.id}
          name={block.props.name}
          setName={setName}
          query={block.props.query}
          uri={block.props.uri}
          setUri={setUri}
          setQuery={setQuery}
          autoRefresh={block.props.autoRefresh}
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
