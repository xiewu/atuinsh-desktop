import { DatabaseIcon } from "lucide-react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";
import { langs } from "@uiw/codemirror-extensions-langs";

import { runQuery } from "./query";

import SQL from "../common/SQL";

interface SQLProps {
  id: string;
  name: string;
  uri: string;
  query: string;
  autoRefresh: number;
  isEditable: boolean;
  collapseQuery: boolean;

  setCollapseQuery: (collapseQuery: boolean) => void;
  setQuery: (query: string) => void;
  setUri: (uri: string) => void;
  setAutoRefresh: (autoRefresh: number) => void;
  setName: (name: string) => void;
}

const Postgres = ({
  id,
  name,
  setName,
  query,
  setQuery,
  uri,
  setUri,
  autoRefresh,
  setAutoRefresh,
  isEditable,
  collapseQuery,
  setCollapseQuery,
}: SQLProps) => {
  return (
    <SQL
      id={id}
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
      collapseQuery={collapseQuery}
      setCollapseQuery={setCollapseQuery}
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
        <Postgres
          id={block.id}
          name={block.props.name}
          setName={setName}
          query={block.props.query}
          collapseQuery={block.props.collapseQuery}
          setCollapseQuery={setCollapseQuery}
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
