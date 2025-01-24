import { useState } from "react";
import { Input, Button } from "@heroui/react";
import { CirclePlusIcon, TrashIcon } from "lucide-react";

const RequestHeaders = ({ pairs, setPairs, disabled }: any) => {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const handleAddPair = () => {
    if (!disabled) {
      if (newKey && newValue) {
        setPairs({
          ...pairs,
          [newKey]: newValue,
        });
        setNewKey("");
        setNewValue("");
      }
    }
  };

  const handleDeletePair = (key: string) => {
    if (!disabled) {
      const { [key]: _, ...newPairs } = pairs;
      setPairs(newPairs);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {Object.entries(pairs).map(([key, value]) => (
        <div key={key} className="flex items-center gap-2">
          <Input
            value={key}
            readOnly
            className="flex-grow"
            variant="bordered"
            size="sm"
            onDoubleClick={(e) => e.currentTarget.select()}
          />
          <Input
            value={value as string}
            readOnly
            className="flex-grow"
            variant="bordered"
            size="sm"
            onDoubleClick={(e) => e.currentTarget.select()}
          />
          <Button
            color="danger"
            onPress={() => handleDeletePair(key)}
            isIconOnly
            variant="bordered"
            size="sm"
            disabled={disabled}
          >
            <TrashIcon size={18} />
          </Button>
        </div>
      ))}

      <div className="flex flex-row items-center gap-2">
        <Input
          value={newKey}
          onValueChange={(val) => {
            setNewKey(val);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleAddPair()}
          placeholder="Header name"
          className="flex-grow"
          variant="bordered"
          size="sm"
          disabled={disabled}
        />
        <Input
          value={newValue}
          onValueChange={(val) => {
            setNewValue(val);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleAddPair()}
          placeholder="Header value"
          className="flex-grow"
          variant="bordered"
          size="sm"
          disabled={disabled}
        />
        <Button
          color="primary"
          variant="bordered"
          onPress={handleAddPair}
          isIconOnly
          size="sm"
          disabled={disabled}
        >
          <CirclePlusIcon size={18} />
        </Button>
      </div>
    </div>
  );
};

export default RequestHeaders;
