import { GlobeIcon } from "lucide-react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";

import { Http } from "./component";
import { HttpBlock as HttpBlockType, HttpVerb, HttpHeaders, HTTP_BLOCK_SCHEMA } from "./schema";
import { DependencySpec } from "@/lib/workflow/dependency";
import track_event from "@/tracking";

export default createReactBlockSpec(
  HTTP_BLOCK_SCHEMA,
  {
    // @ts-ignore
    render: ({ block, editor, code, type }) => {
      const setUrl = (url: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, url: url },
        });
      };

      const setVerb = (verb: HttpVerb) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, verb: verb },
        });
      };

      const setBody = (body: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, body: body },
        });
      };

      const setName = (name: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, name },
        });
      };

      const setHeaders = (headers: HttpHeaders) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, headers: JSON.stringify(headers) },
        });
      };

      const setDependency = (dependency: DependencySpec) => {
        editor.updateBlock(block, {
          props: { ...block.props, dependency: dependency.serialize() },
        });
      };

      let dependency = DependencySpec.deserialize(block.props.dependency);
      let blockType = new HttpBlockType(
        block.id,
        block.props.name,
        dependency,
        block.props.url,
        block.props.verb as HttpVerb,
        JSON.parse(block.props.headers),
      );

      return (
        <Http
          http={blockType}
          setDependency={setDependency}
          body={block.props.body || ""}
          isEditable={editor.isEditable}
          setUrl={setUrl}
          setVerb={setVerb}
          setBody={setBody}
          setName={setName}
          setHeaders={setHeaders}
        />
      );
    },
  },
);

export const insertHttp = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
  title: "HTTP",
  onItemClick: () => {
    track_event("runbooks.block.create", { type: "http" });

    let httpBlocks = editor.document.filter((block: any) => block.type === "http");
    let name = `HTTP ${httpBlocks.length + 1}`;

    editor.insertBlocks(
      [
        {
          type: "http",
          // @ts-ignore
          props: {
            name: name,
          },
        },
      ],
      editor.getTextCursorPosition().block.id,
      "before",
    );
  },
  icon: <GlobeIcon size={18} />,
  group: "Network",
});
