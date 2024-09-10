import { DatabaseIcon } from "lucide-react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";

import { runQuery } from "./query";

import SQL from "../common/SQL";

interface SQLProps {
  uri: string;
  query: string;
  autoRefresh: number;

  setQuery: (query: string) => void;
  setUri: (uri: string) => void;
  setAutoRefresh: (autoRefresh: number) => void;
}

const Postgres = ({
  query,
  setQuery,
  uri,
  setUri,
  autoRefresh,
  setAutoRefresh,
}: SQLProps) => {
  return (
    <SQL
      name="PostgreSQL"
      query={query}
      setQuery={setQuery}
      uri={uri}
      setUri={setUri}
      autoRefresh={autoRefresh}
      setAutoRefresh={setAutoRefresh}
      runQuery={runQuery}
    />
  );
};

export default createReactBlockSpec(
  {
    type: "postgres",
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
        <Postgres
          query={block.props.query}
          uri={block.props.uri}
          setUri={setUri}
          setQuery={setQuery}
          autoRefresh={block.props.autoRefresh}
          setAutoRefresh={setAutoRefresh}
        />
      );
    },
  },
);

export const insertPostgres =
  (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
    title: "PostgreSQL",
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: "postgres",
      });
    },
    icon: <DatabaseIcon size={18} />,
    group: "Database",
  });
