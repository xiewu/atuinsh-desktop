import { DatabaseIcon } from "lucide-react";

import "@glideapps/glide-data-grid/dist/index.css";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";

import { runQuery } from "./query";
import SQL from "../common/SQL";

interface SQLiteProps {
  uri: string;
  query: string;
  autoRefresh: number;
  isEditable: boolean;

  setQuery: (query: string) => void;
  setUri: (uri: string) => void;
  setAutoRefresh: (autoRefresh: number) => void;
}

const SQLite = ({
  query,
  setQuery,
  uri,
  setUri,
  autoRefresh,
  setAutoRefresh,
  isEditable,
}: SQLiteProps) => {
  return (
    <SQL
      eventName="runbooks.sqlite"
      name="SQLite"
      query={query}
      setQuery={setQuery}
      uri={uri}
      setUri={setUri}
      autoRefresh={autoRefresh}
      setAutoRefresh={setAutoRefresh}
      runQuery={runQuery}
      isEditable={isEditable}
    />
  );
};

export default createReactBlockSpec(
  {
    type: "sqlite",
    propSchema: {
      query: { default: "" },
      uri: { default: "" },
      autoRefresh: { default: 0 },
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

      return (
        <SQLite
          query={block.props.query}
          uri={block.props.uri}
          setUri={setUri}
          setQuery={setQuery}
          autoRefresh={block.props.autoRefresh}
          setAutoRefresh={setAutoRefresh}
          isEditable={editor.isEditable}
        />
      );
    },
  },
);

export const insertSQLite =
  (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
    title: "SQLite",
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: "sqlite",
      });
    },
    icon: <DatabaseIcon size={18} />,
    group: "Database",
  });
