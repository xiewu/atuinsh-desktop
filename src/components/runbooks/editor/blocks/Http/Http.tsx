import { useState } from "react";
import {
  Input,
  Card,
  CardBody,
  CardFooter,
  Tabs,
  Tab,
  Textarea,
} from "@nextui-org/react";
import { GlobeIcon } from "lucide-react";
import { fetch } from "@tauri-apps/plugin-http";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";
import { CardHeader } from "@/components/ui/card";
import PlayButton from "../common/PlayButton";
import HttpResponse from "./HttpResponse";
import HttpVerbDropdown from "./VerbDropdown";
import RequestHeaders from "./RequestHeaders";

enum HttpVerb {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  PATCH = "PATCH",
  HEAD = "HEAD",
}

type HttpHeaders = { [key: string]: string };

interface HttpProps {
  url: string;
  verb: HttpVerb;
  body: string;

  headers: HttpHeaders;

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

    if (verb !== "GET" && verb !== "HEAD" && body) {
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
  url,
  verb,
  body,
  headers,
  setUrl,
  setVerb,
  setBody,
  setHeaders,
}: HttpProps) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [response, setResponse] = useState<any | null>(null);
  const [error, setError] = useState<any | null>(null);

  const [activeTab, setActiveTab] = useState("headers");

  const onPlay = async () => {
    setIsRunning(true);
    try {
      let res = await makeHttpRequest(url, verb, body, headers);

      setResponse(res);
      setError(null);
    } catch (error) {
      console.error("Request failed:", error);
      setResponse(null);
      setError(error);
    }
    setIsRunning(false);
  };

  return (
    <Card
      className="w-full !max-w-full !outline-none overflow-none"
      shadow="sm"
    >
      <CardHeader className="p-3 gap-2 bg-default-50">
        <span className="text-default-700 font-semibold">HTTP</span>
        <div className="flex flex-row items-center gap-2">
          <PlayButton
            eventName="runbooks.http.run"
            isRunning={isRunning}
            onPlay={onPlay}
            cancellable={false}
          />

          <HttpVerbDropdown selectedVerb={verb} onVerbChange={setVerb} />

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
            onClick={(e) => { e.stopPropagation() }}
          />
        </div>
      </CardHeader>
      <CardBody>
        <Tabs
          aria-label="Options"
          selectedKey={activeTab}
          onSelectionChange={setActiveTab as any}
          variant="underlined"
        >
          <Tab key="headers" title="Headers">
            <RequestHeaders pairs={headers} setPairs={setHeaders} />
          </Tab>
          <Tab key="body" title="Body" isDisabled={verb === "GET"}>
            <Textarea
              placeholder="Request Body (JSON)"
              value={body}
              onValueChange={setBody}
              minRows={5}
              className="mt-2"
              onClick={(e) => { e.stopPropagation() }}
            />
          </Tab>
        </Tabs>
      </CardBody>
      <CardFooter className="overflow-x-scroll">
        {(response || error) && (
          <HttpResponse response={response} error={error} />
        )}
      </CardFooter>
    </Card>
  );
};

export default createReactBlockSpec(
  {
    type: "http",
    propSchema: {
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

      const setVerb = (verb: string) => {
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

      const setHeaders = (headers: HttpHeaders) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, headers: JSON.stringify(headers) },
        });
      };

      return (
        <Http
          url={block.props.url}
          verb={block.props.verb as HttpVerb}
          body={block.props.body}
          headers={JSON.parse(block.props.headers || "{}")}
          setUrl={setUrl}
          setVerb={setVerb}
          setBody={setBody}
          setHeaders={setHeaders}
        />
      );
    },
  },
);

export const insertHttp =
  (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
    title: "HTTP",
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: "http",
      });
    },
    icon: <GlobeIcon size={18} />,
    group: "Network",
  });
