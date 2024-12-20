import { DatabaseIcon } from "lucide-react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";
import { langs } from "@uiw/codemirror-extensions-langs";

import { runQuery } from "./query";

import SQL from "../common/SQL";

interface SQLProps {
  name: string;
  uri: string;
  query: string;
  autoRefresh: number;
  isEditable: boolean;

  setQuery: (query: string) => void;
  setUri: (uri: string) => void;
  setAutoRefresh: (autoRefresh: number) => void;
  setName: (name: string) => void;
}

const Postgres = ({
  name,
  setName,
  query,
  setQuery,
  uri,
  setUri,
  autoRefresh,
  setAutoRefresh,
  isEditable,
}: SQLProps) => {
  return (
    <SQL
      eventName="runbooks.postgresql"
      name={name}
      setName={setName}
      query={query}
      setQuery={setQuery}
      uri={uri}
      setUri={setUri}
      autoRefresh={autoRefresh}
      setAutoRefresh={setAutoRefresh}
      runQuery={runQuery}
      extensions={[langs.pgsql()]}
      isEditable={isEditable}
    />
  );
};

export default createReactBlockSpec(
  {
    type: "postgres",
    propSchema: {
      name: { default: "PostgreSQL" },
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

      const setName = (name: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, name: name },
        });
      };

      return (
        <Postgres
          name={block.props.name}
          setName={setName}
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

export const insertPostgres = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
  title: "PostgreSQL",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "postgres",
    });
  },
  icon: <DatabaseIcon size={18} />,
  group: "Database",
});
