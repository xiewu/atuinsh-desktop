import { useState } from "react";
import { Input, Button } from "@nextui-org/react";
import { CirclePlusIcon, TrashIcon } from "lucide-react";

const RequestHeaders = ({ pairs, setPairs }: any) => {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  const handleAddPair = () => {
    if (newKey && newValue) {
      setPairs({
        ...pairs,
        [newKey]: newValue,
      });
      setNewKey("");
      setNewValue("");
    }
  };

  const handleDeletePair = (key: string) => {
    const { [key]: _, ...newPairs } = pairs;
    setPairs(newPairs);
  };

  return (
    <div className="flex flex-col gap-4"
      onClick={(e) => { e.stopPropagation() }}
    >
      {Object.entries(pairs).map(([key, value]) => (
        <div key={key} className="flex items-center gap-2">
          <Input
            value={key}
            readOnly
            className="flex-grow"
            variant="bordered"
            size="sm"
          />
          <Input
            value={value as string}
            readOnly
            className="flex-grow"
            variant="bordered"
            size="sm"
          />
          <Button
            color="danger"
            onPress={() => handleDeletePair(key)}
            isIconOnly
            variant="bordered"
            size="sm"
          >
            <TrashIcon size={18} />
          </Button>
        </div>
      ))}
      <div className="flex flex-row items-center gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="Header name"
          className="flex-grow"
          variant="bordered"
          size="sm"
        />
        <Input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder="Header value"
          className="flex-grow"
          variant="bordered"
          size="sm"
        />
        <Button
          color="primary"
          variant="bordered"
          onPress={handleAddPair}
          isIconOnly
          size="sm"
        >
          <CirclePlusIcon size={18} />
        </Button>
      </div>
    </div>
  );
};

export default RequestHeaders;
