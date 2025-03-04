import { DatabaseIcon } from "lucide-react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";

import { runQuery } from "./query";
import SQL from "../common/SQL";
import { ClickhouseBlock } from "@/lib/blocks/clickhouse";

interface SQLProps {
  isEditable: boolean;
  collapseQuery: boolean;
  clickhouse: ClickhouseBlock;

  setQuery: (query: string) => void;
  setUri: (uri: string) => void;
  setAutoRefresh: (autoRefresh: number) => void;
  setName: (name: string) => void;
  setCollapseQuery: (collapseQuery: boolean) => void;
}

const Clickhouse = ({
  clickhouse,
  setQuery,
  setUri,
  setAutoRefresh,
  isEditable,
  setName,
  collapseQuery,
  setCollapseQuery,
}: SQLProps) => {
  return (
    <SQL
      block={clickhouse}
      id={clickhouse.id}
      eventName="runbooks.clickhouse"
      name={clickhouse.name}
      setName={setName}
      query={clickhouse.query}
      setQuery={setQuery}
      uri={clickhouse.uri}
      setUri={setUri}
      autoRefresh={clickhouse.autoRefresh}
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
    type: "clickhouse",
    propSchema: {
      name: { default: "Clickhouse" },
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

      let clickhouse = new ClickhouseBlock(
        block.id, 
        block.props.name, 
        block.props.query, 
        block.props.uri, 
        block.props.autoRefresh
      );

      return (
        <Clickhouse
          clickhouse={clickhouse}
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
