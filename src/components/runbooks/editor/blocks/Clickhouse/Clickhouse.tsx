import { DatabaseIcon } from "lucide-react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";

import { runQuery } from "./query";

import SQL from "../common/SQL";

interface SQLProps {
  id: string;
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

const Clickhouse = ({
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
}: SQLProps) => {
  return (
    <SQL
      id={id}
      name={name}
      setName={setName}
      eventName="runbooks.clickhouse"
      placeholder="http://username:password@localhost:8123/?database=default"
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
    type: "clickhouse",
    propSchema: {
      name: { default: "Clickhouse" },
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
        <Clickhouse
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
        />
      );
    },
  },
);

export const insertClickhouse = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
  title: "Clickhouse",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "clickhouse",
    });
  },
  icon: <DatabaseIcon size={18} />,
  group: "Database",
});
