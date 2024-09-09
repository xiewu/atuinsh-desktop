import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Tabs,
  Tab,
  Chip,
  Tooltip,
  Divider,
} from "@nextui-org/react";
import { Clock, CheckCircle, AlertCircle, Info, WifiOff } from "lucide-react";
import JsonView from "@uiw/react-json-view";

import "./style.css";
import ResultTable from "../common/ResultTable";

const renderBody = (body: string, headers: any) => {
  let contentType = headers["content-type"];
  if (contentType && contentType.includes("application/json")) {
    try {
      const jsonData = typeof body === "string" ? JSON.parse(body) : body;
      return (
        <JsonView
          value={jsonData}
          style={{ backgroundColor: "transparent", userSelect: "text" }}
          displayDataTypes={false}
          displayObjectSize={false}
          enableClipboard={false}
          collapsed={1}
        />
      );
    } catch (error) {
      return (
        <pre className="whitespace-pre-wrap break-words text-sm select-text">
          {body}
        </pre>
      );
    }
  }
  return (
    <pre className="whitespace-pre-wrap break-words text-sm select-text">
      {body}
    </pre>
  );
};

const HttpResponse = ({ response, error }: any) => {
  const [activeTab, setActiveTab] = useState<any>("body");

  if (error) {
    return (
      <Card shadow="sm" className="w-full max-w-full border border-danger-200">
        <CardHeader className="flex justify-between items-center bg-danger-50">
          <div className="flex items-center gap-3">
            <Chip
              color="danger"
              variant="flat"
              startContent={<WifiOff size={14} />}
              className="pl-3 py-2"
            >
              Error
            </Chip>
            <span className="text-danger-700 font-semibold">
              Connection Error
            </span>
          </div>
        </CardHeader>
        <CardBody className="p-4">
          <p className="text-danger-600 select-text">
            {error.message ||
              "An error occurred while making the request. Please check your connection and try again."}
          </p>
        </CardBody>
      </Card>
    );
  }

  if (!response) {
    return null;
  }

  const { status, statusText, headers, data } = response;

  const headerEntries = Array.from(Object.entries(headers));

  const getStatusInfo = (status: any) => {
    if (status >= 200 && status < 300)
      return { color: "success", icon: CheckCircle };
    if (status >= 300 && status < 400) return { color: "warning", icon: Info };
    if (status >= 400) return { color: "danger", icon: AlertCircle };
    return { color: "default", icon: Info };
  };

  const statusInfo = getStatusInfo(status);

  return (
    <Card shadow="sm" className="w-full max-w-full border border-default-200">
      <CardHeader className="flex justify-between items-center bg-default-50">
        <div className="flex items-center gap-3">
          <Chip
            color={statusInfo.color as any}
            variant="flat"
            startContent={<statusInfo.icon size={14} />}
            className="pl-3 py-2"
          >
            {status}
          </Chip>
          <span className="text-default-700 font-semibold select-text">
            {statusText}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Tooltip content="Request duration">
            <div className="flex items-center gap-1 text-default-500">
              <Clock size={14} />
              <span className="text-sm select-text">
                {parseFloat(response.duration.toFixed(3))}ms
              </span>
            </div>
          </Tooltip>
          <span className="text-sm text-default-400 select-text">
            {response.time.toLocaleString()}
          </span>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="p-0">
        <Tabs
          aria-label="Response tabs"
          selectedKey={activeTab}
          onSelectionChange={setActiveTab}
          className="p-4"
          variant="underlined"
        >
          <Tab key="body" title="Body" className="p-0">
            <div className="mt-4 p-4 bg-default-50 rounded-lg overflow-auto max-h-96">
              {renderBody(data, headers)}
            </div>
          </Tab>
          <Tab key="headers" title="Headers" className="p-0">
            <ResultTable
              results={headerEntries}
              width={"100%"}
              columns={[
                {
                  id: "Header",
                  title: "Header",
                  grow: 1,
                },
                {
                  id: "Value",
                  title: "Value",
                  grow: 1,
                },
              ]}
            />
          </Tab>
        </Tabs>
      </CardBody>
    </Card>
  );
};

export default HttpResponse;
