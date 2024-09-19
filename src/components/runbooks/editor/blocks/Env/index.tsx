import React, { useState } from "react";
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
  let [nameState, setNameState] = useState(name);
  let [valueState, setValueState] = useState(value);

  const handleKeyChange = (e: React.FormEvent<HTMLInputElement>) => {
    const newKey = e.currentTarget.value;

    setNameState(newKey);
    onUpdate(newKey, valueState);

    console.log(newKey, valueState);
  };

  const handleValueChange = (e: React.FormEvent<HTMLInputElement>) => {
    const newValue = e.currentTarget.value;

    setValueState(newValue);
    onUpdate(nameState, newValue);

    console.log(nameState, newValue);
  };

  return (
    <div className="!outline-none w-full !max-w-full overflow-none" onClick={(e) => e.stopPropagation()}>
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
                value={nameState}
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
              value={valueState}
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
    </div>
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
