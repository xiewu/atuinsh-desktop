import React from "react";
import { Input, Tooltip, Button } from "@nextui-org/react";
import { VariableIcon } from "lucide-react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";

interface EnvProps {
  name: string;
  value: string;
  onUpdate: (name: string, value: string) => void;
}

const Env = ({ name = "", value = "", onUpdate }: EnvProps) => {
  const handleKeyChange = (e: React.FormEvent<HTMLInputElement>) => {
    onUpdate(e.currentTarget.value, value);
  };

  const handleValueChange = (e: React.FormEvent<HTMLInputElement>) => {
    onUpdate(name, e.currentTarget.value);
  };

  return (
    <Tooltip
      content="Set an environment variable for all subsequent code blocks"
      delay={1000}
      className="outline-none"
    >
      <div className="flex flex-row items-center space-x-2 w-full ">
        <div className="flex flex-1 flex-row gap-2 ">
          <div className="">
            <Button isIconOnly isDisabled variant="light">
              <VariableIcon />
            </Button>
          </div>

          <div className="flex-grow">
            <Input
              placeholder="Name"
              value={name}
              onChange={handleKeyChange}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              className="flex-1"
            />
          </div>
        </div>

        <div className="flex-1">
          <Input
            placeholder="Value"
            value={value}
            onChange={handleValueChange}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            className="flex-1"
          />
        </div>
      </div>
    </Tooltip>
  );
};

export default createReactBlockSpec(
  {
    type: "env",
    propSchema: {
      name: { default: "" },
      value: { default: "" },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor, code, type }) => {
      const onUpdate = (name: string, value: string): void => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, name: name, value: value },
        });
      };

      return (
        <Env
          name={block.props.name}
          value={block.props.value}
          onUpdate={onUpdate}
        />
      );
    },
  },
);
