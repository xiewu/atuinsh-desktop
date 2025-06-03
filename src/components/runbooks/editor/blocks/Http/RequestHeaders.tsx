import { useState, useEffect, useRef } from "react";
import { Input, Checkbox, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from "@heroui/react";
import { ChevronDownIcon, TrashIcon } from "lucide-react";

interface HeaderRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface RequestHeadersProps {
  pairs: { [key: string]: string };
  setPairs: (pairs: { [key: string]: string }) => void;
  disabled?: boolean;
}

const RequestHeaders = ({ pairs, setPairs, disabled = false }: RequestHeadersProps) => {
  const [rows, setRows] = useState<HeaderRow[]>([]);
  const nextIdRef = useRef(0);
  const isInternalUpdateRef = useRef(false);

  // Initialize rows from pairs only once on mount or when pairs change externally (not from our updates)
  useEffect(() => {
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    const headerRows = Object.entries(pairs).map(([key, value]) => ({
      id: `header-${nextIdRef.current++}`,
      key,
      value,
      enabled: true,
    }));
    
    // Always ensure there's at least one empty row at the end
    headerRows.push({
      id: `empty-${nextIdRef.current++}`,
      key: "",
      value: "",
      enabled: true,
    });
    
    setRows(headerRows);
  }, [pairs]);

  const updatePairsFromRows = (updatedRows: HeaderRow[]) => {
    const newPairs: { [key: string]: string } = {};
    updatedRows.forEach(row => {
      if (row.enabled && row.key.trim() && row.value.trim()) {
        newPairs[row.key.trim()] = row.value.trim();
      }
    });
    
    // Mark that this is an internal update so the useEffect doesn't trigger
    isInternalUpdateRef.current = true;
    setPairs(newPairs);
  };

  const handleRowChange = (rowId: string, field: 'key' | 'value' | 'enabled', newValue: string | boolean) => {
    setRows(currentRows => {
      const updatedRows = currentRows.map(row => {
        if (row.id === rowId) {
          return { ...row, [field]: newValue };
        }
        return row;
      });

      // Check if we need to add a new empty row
      const lastRow = updatedRows[updatedRows.length - 1];
      const needsNewRow = lastRow.key.trim() !== "" || lastRow.value.trim() !== "";
      
      if (needsNewRow) {
        updatedRows.push({
          id: `empty-${nextIdRef.current++}`,
          key: "",
          value: "",
          enabled: true,
        });
      }

      // Update pairs after state change
      updatePairsFromRows(updatedRows);
      
      return updatedRows;
    });
  };

  const handleDeleteRow = (rowId: string) => {
    if (disabled) return;
    
    setRows(currentRows => {
      const updatedRows = currentRows.filter(row => row.id !== rowId);
      
      // Ensure there's always at least one empty row
      const hasEmptyRow = updatedRows.some(row => row.key.trim() === "" && row.value.trim() === "");
      if (!hasEmptyRow) {
        updatedRows.push({
          id: `empty-${nextIdRef.current++}`,
          key: "",
          value: "",
          enabled: true,
        });
      }
      
      // Update pairs after state change
      updatePairsFromRows(updatedRows);
      
      return updatedRows;
    });
  };

  const isEmptyRow = (row: HeaderRow) => row.key.trim() === "" && row.value.trim() === "";

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <Checkbox
            isSelected={row.enabled}
            onValueChange={(enabled) => handleRowChange(row.id, 'enabled', enabled)}
            size="sm"
            disabled={disabled || isEmptyRow(row)}
            className="min-w-fit"
          />
          
          <Input
            value={row.key}
            onValueChange={(value) => handleRowChange(row.id, 'key', value)}
            placeholder="Header-Name"
            className="flex-grow"
            variant="bordered"
            size="sm"
            disabled={disabled}
            autoComplete="off"
            spellCheck="false"
            autoCorrect="off"
            autoCapitalize="off"
            classNames={{
              input: "text-small font-mono",
              inputWrapper: "h-8 min-h-unit-8 bg-gray-50 dark:bg-gray-900/50",
            }}
          />
          
          <Input
            value={row.value}
            onValueChange={(value) => handleRowChange(row.id, 'value', value)}
            placeholder="value"
            className="flex-grow"
            variant="bordered"
            size="sm"
            disabled={disabled}
            autoComplete="off"
            spellCheck="false"
            autoCorrect="off"
            autoCapitalize="off"
            classNames={{
              input: "text-small font-mono",
              inputWrapper: "h-8 min-h-unit-8 bg-gray-50 dark:bg-gray-900/50",
            }}
          />
          
          <Dropdown>
            <DropdownTrigger>
              <Button
                variant="light"
                size="sm"
                isIconOnly
                disabled={disabled || isEmptyRow(row)}
                className="min-w-8 w-8 h-8"
              >
                <ChevronDownIcon size={16} />
              </Button>
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem
                key="delete"
                startContent={<TrashIcon size={16} />}
                color="danger"
                onPress={() => handleDeleteRow(row.id)}
              >
                Delete
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      ))}
    </div>
  );
};

export default RequestHeaders;
