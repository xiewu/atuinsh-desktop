import React from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
} from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { HttpVerb } from "../schema";

interface HttpVerbDropdownProps {
  selectedVerb: HttpVerb;
  onVerbChange: (verb: HttpVerb) => void;
  disabled: boolean;
}

const HttpVerbDropdown: React.FC<HttpVerbDropdownProps> = ({
  selectedVerb,
  onVerbChange,
  disabled = false,
}) => {
  const verbColors: Record<HttpVerb, string> = {
    [HttpVerb.GET]: "success",
    [HttpVerb.POST]: "primary",
    [HttpVerb.PUT]: "warning",
    [HttpVerb.DELETE]: "danger",
    [HttpVerb.PATCH]: "secondary",
    [HttpVerb.HEAD]: "default",
  };

  return (
    <Dropdown isDisabled={disabled}>
      <DropdownTrigger>
        <Button
          variant="bordered"
          color={verbColors[selectedVerb] as any}
          endContent={<ChevronDown size={16} />}
          size="sm"
          className="px-3 py-1"
        >
          {selectedVerb}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="HTTP Verb selection"
        onAction={(key) => onVerbChange(key as HttpVerb)}
      >
        {Object.values(HttpVerb).map((verb) => (
          <DropdownItem key={verb} color={verbColors[verb] as any}>
            {verb}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
};

export default HttpVerbDropdown;
