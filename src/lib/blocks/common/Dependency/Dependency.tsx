import React, { useMemo, useState } from "react";
import { WorkflowIcon } from "lucide-react";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Tooltip,
  Autocomplete,
  AutocompleteItem,
  ButtonGroup,
} from "@heroui/react";
import Block from "@/lib/workflow/blocks/block";
import { useBlockNoteEditor } from "@blocknote/react";
import { blocksBefore, convertBlocknoteToAtuin } from "@/lib/workflow/blocks/convert";
import { DependencySpec } from "@/lib/workflow/dependency";

interface DependencyProps {
  block: Block;

  setDependency: (dependency: DependencySpec) => void;
}

const Dependency: React.FC<DependencyProps> = ({ block, setDependency }) => {
  let editor = useBlockNoteEditor();

  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  const handleSave = () => {
    setDependency(new DependencySpec([selectedParent?.id || ""], block.dependency?.within || 0));
    handleClose();
  };

  const parent = useMemo(() => {
    if (block.dependency?.parent) {
      let bnb = editor.document.find((b: any) => b.id === block.dependency.parent);
      if (bnb) {
        let block = convertBlocknoteToAtuin(bnb);
        return block;
      }
    }

    return null;
  }, [block.dependency?.parent]);

  const [selectedParent, setSelectedParent] = useState<Block | null>(parent);

  // Filter out the current block from available parents
  const availableParents = useMemo(() => {
    let blocks = blocksBefore(block.id, editor.document);
    return blocks.filter((b) => b.name !== block.name && b != null);
  }, [editor.document, block]);

  return (
    <>
      <Tooltip content="Workflow settings">
        <Button
          variant="flat"
          size="sm"
          onPress={handleOpen}
          isIconOnly
          className="flex items-center gap-2"
        >
          <WorkflowIcon className="h-4 w-4" />
        </Button>
      </Tooltip>

      <Modal isOpen={isOpen} onClose={handleClose} size="2xl">
        <ModalContent>
          <ModalHeader>Workflow Settings</ModalHeader>
          <ModalBody>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-2">Block Dependencies</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Configure how this block depends on other blocks in the Runbook. Blocks must have
                  a unique name to be used as a dependency. Blocks can only depend on blocks before
                  them in the runbook.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center mb-2">
                    <label htmlFor="parent-block" className="text-sm font-medium">
                    Dependency
                    </label>
                    <Tooltip content="The dependency block must complete successfully before this block can run">
                      <div className="ml-2 text-gray-400 cursor-help">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M12 16v-4"></path>
                          <path d="M12 8h.01"></path>
                        </svg>
                      </div>
                    </Tooltip>
                  </div>

                  <div className="flex gap-2 items-center">
                    <Autocomplete
                      id="parent-block"
                      className="w-full"
                      defaultItems={availableParents}
                      selectedKey={selectedParent ? selectedParent.name : ""}
                      onSelectionChange={(key) => {
                        if (key === "") {
                          setSelectedParent(null);
                        } else {
                          const selected = availableParents.find((b) => b.name === key);
                          setSelectedParent(selected || null);
                        }
                      }}
                      placeholder="Select a parent block"
                    >
                      {(block) => (
                        <AutocompleteItem key={block.name} textValue={block.name}>
                          {block.name}
                        </AutocompleteItem>
                      )}
                    </Autocomplete>

                    {selectedParent && (
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={() => setSelectedParent(null)}
                        className="shrink-0"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {selectedParent && (
                  <div>
                    <div className="flex items-center mb-2">
                      <label className="text-sm font-medium">Dependency Timing</label>
                      <Tooltip content="Configure when this block can run relative to its parent">
                        <div className="ml-2 text-gray-400 cursor-help">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M12 16v-4"></path>
                            <path d="M12 8h.01"></path>
                          </svg>
                        </div>
                      </Tooltip>
                    </div>

                    <div className="mb-4">
                      <ButtonGroup variant="flat" className="w-full">
                        <Button
                          className="flex-1"
                          color={block.dependency?.within === 0 ? "primary" : "default"}
                          onPress={() => {
                            if (block.dependency) {
                              setDependency(new DependencySpec(block.dependency.parents, 0));
                            }
                          }}
                        >
                        Always required
                        </Button>
                        <Button
                          className="flex-1"
                          color={block.dependency?.within > 0 ? "primary" : "default"}
                          onPress={() => {
                            setDependency(new DependencySpec(block.dependency?.parents || [], 1));
                          }}
                        >
                        Required once
                        </Button>
                        <Button
                          className="flex-1"
                          color={block.dependency?.within === -1 ? "primary" : "default"}
                          onPress={() => {
                            setDependency(new DependencySpec(block.dependency?.parents || [], -1));
                          }}
                        >
                        Any time
                        </Button>
                      </ButtonGroup>
                    </div>

                    {block.dependency?.within > 0 && (
                      <div className="flex items-center gap-2 mb-4">
                        <label className="text-sm whitespace-nowrap">Time period:</label>
                        <input
                          type="number"
                          className="border rounded p-1 w-20"
                          value={block.dependency?.within}
                          onChange={(e) => {
                            let seconds = parseFloat(e.target.value);
                            if (seconds == 0 || seconds == -1 || isNaN(seconds)) return;
                            setDependency(
                              new DependencySpec(block.dependency?.parents || [], seconds),
                            );
                          }}
                          min="0"
                          step="1"
                        />
                        <span className="text-sm">seconds</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
                  <h4 className="text-sm font-medium mb-2">Execution Behavior</h4>
                  {!selectedParent ? (
                    <p className="text-sm text-gray-600">
                      The dependency must run successfully before this block can run.
                    </p>
                  ) : block.dependency?.within === 0 ? (
                    <p className="text-sm text-gray-600">
                      This block will only run once for earch time "{selectedParent.name}" completes
                      successfully.
                    </p>
                  ) : block.dependency?.within > 0 ? (
                    <p className="text-sm text-gray-600">
                      This block can run any number of times within{" "}
                      {(block.dependency.within / 60).toFixed(1)} minutes after "
                      {selectedParent.name}" completes successfully.
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600">
                      This block can run anytime after "{selectedParent.name}" has completed
                      successfully, at some point in the past.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="default" variant="flat" onPress={handleClose} className="mr-2">
              Cancel
            </Button>
            <Button color="primary" onPress={handleSave}>
              Save changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default Dependency;
