import { useState } from "react";
import { Input, Tabs, Tab } from "@heroui/react";
import { GlobeIcon } from "lucide-react";
import { fetch } from "@tauri-apps/plugin-http";
import CodeMirror from "@uiw/react-codemirror";
import { langs } from "@uiw/codemirror-extensions-langs";

// @ts-ignore
import { createReactBlockSpec, useBlockNoteEditor } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";
import PlayButton from "../common/PlayButton";
import HttpResponse from "./HttpResponse";
import HttpVerbDropdown from "./VerbDropdown";
import RequestHeaders from "./RequestHeaders";
import Block from "../common/Block";
import { templateString } from "@/state/templates";
import { useStore } from "@/state/store";
import { logExecution } from "@/lib/exec_log";
import { HttpBlock as HttpBlockType, HttpVerb } from "@/lib/blocks/http";

type HttpHeaders = { [key: string]: string };

interface HttpProps {
  id: string;
  name: string;
  url: string;
  verb: HttpVerb;
  body: string;
  isEditable: boolean;
  headers: HttpHeaders;
  setName: (name: string) => void;
  setUrl: (url: string) => void;
  setVerb: (verb: HttpVerb) => void;
  setBody: (body: string) => void;
  setHeaders: (headers: HttpHeaders) => void;
}

async function makeHttpRequest(
  url: string,
  verb: HttpVerb,
  body: string,
  headers: HttpHeaders,
): Promise<any> {
  try {
    const options: any = {
      method: verb,
      headers: headers,
    };

    if (verb !== HttpVerb.GET && verb !== HttpVerb.HEAD && body) {
      options.body = body;
    }

    let start = performance.now();
    const response = await fetch(url, options);
    let duration = performance.now() - start;

    const responseData = await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers),
      data: responseData,
      duration: duration,
      time: new Date(),
    };
  } catch (error) {
    throw error;
  }
}

const Http = ({
  id,
  name,
  setName,
  url,
  verb,
  body,
  headers,
  isEditable,
  setUrl,
  setVerb,
  setBody,
  setHeaders,
}: HttpProps) => {
  let editor = useBlockNoteEditor();
  const colorMode = useStore((state) => state.functionalColorMode);
  const currentRunbookId = useStore((state) => state.currentRunbookId);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [response, setResponse] = useState<any | null>(null);
  const [error, setError] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState("headers");

  const formatJSON = () => {
    if (verb === HttpVerb.GET || verb === HttpVerb.HEAD) return;

    try {
      let parsed = JSON.parse(body);
      let pretty = JSON.stringify(parsed, null, 2);
      setBody(pretty);
    } catch (e) {
      // If it's not valid JSON, don't try to format it
    }
  };

  const onPlay = async () => {
    setIsRunning(true);
    const startTime = Date.now() * 1000000; // Convert to nanoseconds
    
    let template = async (input: string) => await templateString(id, input, editor.document, currentRunbookId);

    let tUrl = await template(url);
    let tBody = await template(body);
    let tHeaders: { [key: string]: string } = {};

    for (const [key, value] of Object.entries(headers)) {
      const templatedKey = await template(key);
      const templatedValue = await template(value);
      tHeaders[templatedKey] = templatedValue;
    }

    try {
      let res = await makeHttpRequest(tUrl, verb, tBody, tHeaders);
      
      setResponse(res);
      setError(null);
      
      // Log the execution without including the response body
      const endTime = Date.now() * 1000000; // Convert to nanoseconds
      const httpBlock = new HttpBlockType(
        id,
        name,
        url,
        verb,
        headers
      );
      
      // Create a sanitized response object without the body data
      const logResponse = {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
        duration: res.duration,
        time: res.time
      };
      
      await logExecution(
        httpBlock,
        httpBlock.typeName,
        startTime,
        endTime,
        JSON.stringify(logResponse)
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Request failed:", errorMessage);
      setResponse(null);
      setError(err);
      
      // Log the error without including request/response bodies
      const endTime = Date.now() * 1000000; // Convert to nanoseconds
      const httpBlock = new HttpBlockType(
        id,
        name,
        url,
        verb,
        headers
      );
      
      await logExecution(
        httpBlock,
        httpBlock.typeName,
        startTime,
        endTime,
        JSON.stringify({ error: errorMessage })
      );
    }
    
    setIsRunning(false);
    formatJSON();
  };

  return (
    <Block
      name={name}
      setName={setName}
      header={
        <div className="flex flex-row items-center gap-2 w-full">
          <PlayButton
            eventName="runbooks.http.run"
            isRunning={isRunning}
            onPlay={onPlay}
            cancellable={false}
          />

          <HttpVerbDropdown selectedVerb={verb} onVerbChange={setVerb} disabled={!isEditable} />

          <Input
            placeholder="http://localhost:8080/hello/world"
            isRequired
            startContent={<GlobeIcon size={18} />}
            value={url}
            onValueChange={(val) => {
              setUrl(val);
            }}
            classNames={{
              input: "text-small",
              inputWrapper: "h-8 min-h-unit-8 px-1",
            }}
            variant="bordered"
            size="sm"
            disabled={!isEditable}
          />
        </div>
      }
      footer={
        (response || error) && (
          <HttpResponse
            response={response}
            error={error}
            dismiss={() => {
              setResponse(null);
              setError(null);
            }}
          />
        )
      }
    >
      <Tabs
        aria-label="Options"
        selectedKey={activeTab}
        onSelectionChange={setActiveTab as any}
        variant="underlined"
      >
        <Tab key="headers" title="Headers">
          <RequestHeaders pairs={headers} setPairs={setHeaders} disabled={!isEditable} />
        </Tab>
        <Tab key="body" title="Body" isDisabled={verb === HttpVerb.GET} className="overflow-scroll">
          <CodeMirror
            placeholder={"Request Body (JSON)"}
            className="!pt-0 max-w-full border border-gray-300 rounded flex-grow text-sm max-h-96"
            value={body}
            onChange={(val) => {
              setBody(val);
            }}
            basicSetup={true}
            extensions={[langs.json()]}
            editable={isEditable}
            theme={colorMode === "dark" ? "dark" : "light"}
          />
        </Tab>
      </Tabs>
    </Block>
  );
};

export default createReactBlockSpec(
  {
    type: "http",
    propSchema: {
      name: { default: "HTTP" },
      url: { default: "" },
      verb: { default: "GET" },
      body: { default: "" },
      headers: { default: "" },
    },
    content: "none",
  },
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

      return (
        <Http
          id={block.id}
          name={block.props.name || "HTTP"}
          url={block.props.url || ""}
          verb={block.props.verb as HttpVerb}
          body={block.props.body || ""}
          headers={typeof block.props.headers === 'string' ? JSON.parse(block.props.headers || "{}") : (block.props.headers || {})}
          isEditable={editor.isEditable}
          setUrl={setUrl}
          setVerb={setVerb}
          setBody={setBody}
          setName={setName}
          setHeaders={setHeaders}
        />
      );
    },
  }
);

export const insertHttp = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
  title: "HTTP",
  onItemClick: () => {
    insertOrUpdateBlock(editor, {
      type: "http",
    });
  },
  icon: <GlobeIcon size={18} />,
  group: "Network",
});
