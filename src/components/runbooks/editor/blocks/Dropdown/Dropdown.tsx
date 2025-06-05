import React, { useState, useEffect, useMemo, useCallback, Key } from "react";
import {
    Input, Button, Select, SelectItem,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    useDisclosure,
    Tabs,
    Tab
} from "@heroui/react";
import { ListFilterIcon } from "lucide-react";
import { createReactBlockSpec } from "@blocknote/react";

import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/state/store";
import track_event from "@/tracking";
import { findAllParentsOfType, findFirstParentOfType } from "@/lib/blocks/exec.ts";
import { templateString } from "@/state/templates";
import CodeEditor, { TabAutoComplete } from "@/lib/blocks/common/CodeEditor/CodeEditor.tsx";
import InterpreterSelector, { buildInterpreterCommand } from "@/lib/blocks/common/InterpreterSelector.tsx";

// Helper to parse and display option nicely
const parseOption = (option: string) => {
    const trimmed = option.trim();
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex > 0 && colonIndex < trimmed.length - 1) {
        const label = trimmed.substring(0, colonIndex).trim();  // what we display
        const value = trimmed.substring(colonIndex + 1).trim();    // what we store as value
        return { value, label, hasKeyValue: true };
    }
    return { value: trimmed, label: trimmed, hasKeyValue: false };
};

type DropdownOptions = "fixed" | "variable" | "command";

interface DropdownProps {
    name: string;
    id: string;
    options: string;
    optionsType: DropdownOptions;
    value: string;
    interpreter: string;
    isEditable: boolean;
    editor: any;

    onNameUpdate: (name: string) => void;
    onOptionsUpdate: (options: string) => void;
    onValueUpdate: (value: string) => void;
    onOptionsTypeChange: (optionsType: string) => void;
    onInterpreterChange: (interpreter: string) => void;
    onCodeMirrorFocus?: () => void;
}

const FixedTab = ({ options, onOptionsUpdate }: { options: string, onOptionsUpdate: (options: string) => void }) => {
    const [optionsList, setOptionsList] = useState<string[]>(() =>
        options ? options.split(',').map(opt => opt.trim()) : []
    );
    const [newOption, setNewOption] = useState('');

    useEffect(() => {
        setOptionsList(options ? options.split(',').map(opt => opt.trim()) : []);
    }, [options]);

    const addOption = () => {
        if (newOption.trim()) {
            const updatedOptions = [...optionsList, newOption.trim()];
            setOptionsList(updatedOptions);
            onOptionsUpdate(updatedOptions.join(', '));
            setNewOption('');
        }
    };

    const removeOption = (index: number) => {
        const updatedOptions = optionsList.filter((_, i) => i !== index);
        setOptionsList(updatedOptions);
        onOptionsUpdate(updatedOptions.join(', '));
    };


    return (
        <div className="space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Add options as simple values or label:value pairs (e.g., "User Friendly Name:horrible-uuid-value")
            </div>
            
            <div className="flex space-x-2">
                <Input
                    placeholder="Simple value or display label:value"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addOption()}
                    className="flex-1"
                />
                <Button color="primary" onPress={addOption}>Add</Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
                {optionsList.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                        No options added yet
                    </div>
                ) : (
                    optionsList.map((option, index) => {
                        const parsed = parseOption(option);
                        return (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                                <div className="flex-1">
                                    {parsed.hasKeyValue ? (
                                        <div>
                                            <div className="font-medium">{parsed.label}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">→ stores: {parsed.value}</div>
                                        </div>
                                    ) : (
                                        <span>{parsed.label}</span>
                                    )}
                                </div>
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    color="danger"
                                    onPress={() => removeOption(index)}
                                >
                                    ×
                                </Button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

const VariableTab = ({ options, onOptionsUpdate }: { options: string, onOptionsUpdate: (options: string) => void }) => {
    return (
        <div className="space-y-4 py-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Variable should contain newline or comma-separated values. Supports label:value pairs (e.g., "Display Name:id123")
            </div>
            <Input 
                placeholder="Variable name" 
                value={options} 
                onChange={(e) => onOptionsUpdate(e.target.value)}
                style={{ fontFamily: "monospace" }} 
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                className="border-blue-200 dark:border-blue-800"
            />
        </div>
    );
}

interface CommandTabProps {
    options: string;
    onOptionsUpdate: (options: string) => void;
    interpreter: string;
    onInterpreterChange: (interpreter: string) => void;
    onCodeMirrorFocus?: () => void;
}

const CommandTab = ({ options, onOptionsUpdate, interpreter, onInterpreterChange, onCodeMirrorFocus }: CommandTabProps) => {
    const colorMode = useStore((state) => state.functionalColorMode);
    const lightModeEditorTheme = useStore((state) => state.lightModeEditorTheme);
    const darkModeEditorTheme = useStore((state) => state.darkModeEditorTheme);
    
    const theme = colorMode == "dark" ? darkModeEditorTheme : lightModeEditorTheme;
    
    return (
        <div className="space-y-4 py-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                    Enter a shell command that will return a list of options. Supports label:value pairs (e.g., "User Friendly Name:horrible-uuid-value")
                </div>
            <div className="flex justify-between items-center mb-4">
                <InterpreterSelector 
                    interpreter={interpreter} 
                    onInterpreterChange={onInterpreterChange}
                    size="sm"
                    variant="flat"
                />
            </div>
            <div className="min-h-[120px] border border-blue-200 dark:border-blue-800 rounded-md overflow-hidden">
                <CodeEditor
                    id="dropdown-command-editor"
                    code={options}
                    isEditable={true}
                    language={interpreter || "bash"}
                    theme={theme}
                    onChange={onOptionsUpdate}
                    onFocus={onCodeMirrorFocus}
                    keyMap={[TabAutoComplete]}
                />
            </div>
        </div>
    );
}

const Dropdown = ({ editor, id, name = "", options = "", value = "", optionsType = "fixed", interpreter = "bash", onNameUpdate, onOptionsUpdate, onValueUpdate, onOptionsTypeChange, onInterpreterChange, isEditable, onCodeMirrorFocus }: DropdownProps) => {
    const currentRunbookId = useStore((store) => store.currentRunbookId);
    const [selected, setSelected] = useState(value);
    const { isOpen, onOpen, onOpenChange } = useDisclosure();

    useEffect(() => {
        // Only validate fixed options - variable options are handled separately
        if (optionsType === "fixed") {
            const parsedOptions = splitLines(options);
            const validValues = parsedOptions.map(opt => opt.value);

            if (!validValues.includes(value)) {
                onValueUpdate("");
                setSelected("");
            }
        }
    }, [value, options, optionsType, onValueUpdate]);

    // Store variable options separately
    const [variableOptions, setVariableOptions] = useState<{ label: string, value: string }[]>([]);

    // Create a split lines helper function outside the effect
    const splitLines = (value: string) => {
        let lines = value.split("\n").map(line => line.trim()).filter(line => line.length > 0);

        // If no newlines found, try comma splitting
        if (lines.length <= 1) {
            lines = value.split(",");
        }

        const opts = lines.map(parseOption);

        return opts;
    };

    // Function to fetch options - extracted for reuse
    const fetchOptions = useCallback(async () => {
        if (optionsType === "variable" && options && currentRunbookId) {
            try {
                let value = await invoke("get_template_var", {
                    runbook: currentRunbookId,
                    name: options,
                });

                if (typeof value === "string") {
                    setVariableOptions(splitLines(value));
                } else {
                    setVariableOptions([]);
                }
            } catch (error) {
                console.error("Failed to fetch variable:", error);
                setVariableOptions([]);
            }
        } else if (optionsType === "command") {
            let cwd = findFirstParentOfType(editor, id, "directory");
            let vars = findAllParentsOfType(editor, id, "env");
            let env: { [key: string]: string } = {};

            try {
                // Get environment variables
                for (var i = 0; i < vars.length; i++) {
                    let name = await templateString(
                        id,
                        vars[i].props.name,
                        editor.document,
                        currentRunbookId,
                    );
                    let value = await templateString(
                        id,
                        vars[i].props.value,
                        editor.document,
                        currentRunbookId,
                    );
                    env[name] = value;
                }

                // For command type, options contains the shell command to execute
                const commandString = await templateString(
                    id,
                    options,
                    editor.document,
                    currentRunbookId
                );
                
                // Build the interpreter command string using the selected interpreter
                const interpreterCommand = buildInterpreterCommand(interpreter);
                
                let value = await invoke<string>("shell_exec_sync", {
                    interpreter: interpreterCommand,
                    command: commandString,
                    env: env,
                    cwd: cwd?.props.path || "~",
                });
                
                if (value) {
                    setVariableOptions(splitLines(value));
                } else {
                    setVariableOptions([]);
                }
            } catch (error) {
                console.error("Command execution failed:", error);
                setVariableOptions([]);
            }
        }
    }, [options, optionsType, interpreter, currentRunbookId, editor, id]);

    // Fetch options when dependencies change
    useEffect(() => {
        fetchOptions();
    }, [fetchOptions]);
    
    // We're handling refreshes with onOpenChange of the Select component
    // No need for a separate effect listening to modal open state

    // Compute options based on type
    const renderOptions = useMemo(() => {
        if (optionsType === "fixed") {
            return splitLines(options);
        } else if (optionsType === "variable" || optionsType === "command") {
            return variableOptions;
        }
        return [];
    }, [options, optionsType, variableOptions]);

    useEffect(() => {
        (async () => {
            await invoke("set_template_var", {
                runbook: currentRunbookId,
                name: name,
                value: selected,
            });
        })();
    }, [selected]);

    const [hasNameError, setHasNameError] = useState(false);

    // Check for invalid variable name characters (only allow alphanumeric and underscore)
    useEffect(() => {
        const validNamePattern = /^[a-zA-Z0-9_]*$/;
        setHasNameError(!validNamePattern.test(name));
    }, [name]);

    const handleKeyChange = (e: React.FormEvent<HTMLInputElement>) => {
        const newName = e.currentTarget.value;

        // If name is changing and we have a current runbook
        if (name && name !== newName && currentRunbookId) {
            // First, get the current value
            invoke("get_template_var", {
                runbook: currentRunbookId,
                name: name,
            })
                .then((value: any) => {
                    if (value && newName) {
                        // Save under the new name
                        invoke("set_template_var", {
                            runbook: currentRunbookId,
                            name: newName,
                            value: value as string,
                        }).catch(console.error);
                    }
                })
                .catch(console.error);
        }

        onNameUpdate(newName);
    };

    return (
        <>
            <div className="flex flex-row items-center space-x-3 w-full bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-800 dark:to-cyan-950 rounded-lg p-3 border border-blue-200 dark:border-blue-900 shadow-sm hover:shadow-md transition-all duration-200">
                    <div className="flex items-center">
                        <Button isIconOnly variant="light" className="bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300" onPress={onOpen}>
                            <ListFilterIcon className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                            <Input
                                placeholder="Output variable name"
                                value={name}
                                onChange={handleKeyChange}
                                style={{ fontFamily: "monospace" }}
                                autoComplete="off"
                                autoCapitalize="off"
                                autoCorrect="off"
                                spellCheck="false"
                                className={`flex-1 ${hasNameError ? 'border-red-400 dark:border-red-400 focus:ring-red-500' : 'border-blue-200 dark:border-blue-800'}`}
                                disabled={!isEditable}
                                isInvalid={hasNameError}
                                errorMessage={"Variable names can only contain letters, numbers, and underscores"}
                            />
                    </div>

                    <div className="flex-1">
                        <Select
                            disableAnimation
                            items={renderOptions}
                            selectedKeys={[selected]}
                            selectionMode="single"
                            onSelectionChange={(keys) => {
                                const selectedKey = Array.from(keys)[0] as string;
                                setSelected(selectedKey);
                                onValueUpdate(selectedKey); // Store the KEY, not the label
                            }}
                            onOpenChange={(isOpen) => {
                                // Refresh options when dropdown is opened
                                if (isOpen && (optionsType === "variable" || optionsType === "command")) {
                                    fetchOptions();
                                }
                            }}
                        >
                            {(option) => <SelectItem key={option.value}>{option.label}</SelectItem>}
                        </Select>
                    </div>
                </div>
            {isOpen && (
                <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="xl">
                    <ModalContent>
                        {(_onClose) => (<>
                            <ModalHeader className="flex flex-col gap-1">Dropdown Options</ModalHeader>
                            <ModalBody>
                                <Tabs aria-label="Dropdown options" selectedKey={optionsType} fullWidth onSelectionChange={(k: Key) => {
                                        onOptionsTypeChange(k as string);
                                    }}>
                                    <Tab key="fixed" title="Fixed Options">
                                        <FixedTab options={options} onOptionsUpdate={onOptionsUpdate} />
                                    </Tab>
                                    <Tab key="variable" title="Variable Options">
                                        <VariableTab options={options} onOptionsUpdate={onOptionsUpdate} />
                                    </Tab>
                                    <Tab key="command" title={"Command Output"}>
                                        <CommandTab 
                                            options={options} 
                                            onOptionsUpdate={onOptionsUpdate}
                                            interpreter={interpreter}
                                            onInterpreterChange={onInterpreterChange}
                                            onCodeMirrorFocus={onCodeMirrorFocus}
                                        />
                                    </Tab>
                                </Tabs>
                            </ModalBody>
                        </>)}
                    </ModalContent>
                </Modal>
            )}
        </>
    );
};

export default createReactBlockSpec(
    {
        type: "dropdown",
        propSchema: {
            name: { default: "" },
            options: { default: "" },
            value: { default: "" },
            optionsType: { default: "fixed" },
            interpreter: { default: "bash" },
            // No value stored in props - only the key/name is synced
        },
        content: "none",
    },
    {
        // @ts-ignore
        render: ({ block, editor }) => {
            const handleCodeMirrorFocus = () => {
                // Ensure BlockNote knows which block contains the focused CodeMirror
                editor.setTextCursorPosition(block.id, "start");
            };

            const onNameUpdate = (name: string): void => {
                editor.updateBlock(block, {
                    // @ts-ignore
                    props: { ...block.props, name },
                });
            };

            const onOptionsUpdate = (options: string): void => {
                editor.updateBlock(block, {
                    // @ts-ignore
                    props: { ...block.props, options },
                });
            };

            const onValueUpdate = (value: string): void => {
                editor.updateBlock(block, {
                    // @ts-ignore
                    props: { ...block.props, value },
                });
            };

            const onOptionsTypeChange = (optionsType: string): void => {
                editor.updateBlock(block, {
                    // @ts-ignore
                    props: { ...block.props, optionsType, options: "" },
                });
            };
            
            const onInterpreterChange = (interpreter: string): void => {
                editor.updateBlock(block, {
                    // @ts-ignore
                    props: { ...block.props, interpreter },
                });
            };
            // ensure the options type is valid
            if (!["fixed", "variable", "command"].includes(block.props.optionsType)) {
                editor.updateBlock(block, {
                    props: { ...block.props, optionsType: "fixed" },
                });
            }

            return (
                <Dropdown
                    editor={editor}
                    id={block.id}
                    name={block.props.name}
                    options={block.props.options}
                    optionsType={block.props.optionsType as DropdownOptions}
                    value={block.props.value}
                    interpreter={block.props.interpreter}
                    onNameUpdate={onNameUpdate}
                    onOptionsUpdate={onOptionsUpdate}
                    onValueUpdate={onValueUpdate}
                    onOptionsTypeChange={onOptionsTypeChange}
                    onInterpreterChange={onInterpreterChange}
                    isEditable={editor.isEditable}
                    onCodeMirrorFocus={handleCodeMirrorFocus}
                />
            );
        },
    },
);

// Component to insert this block from the editor menu
export const insertDropdown = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
    title: "Dropdown",
    subtext: "Select from a list of options, sourced from a variable, command or fixed list",
    onItemClick: () => {
        track_event("runbooks.block.create", { type: "dropdown" });

        editor.insertBlocks(
        [
            {
          type: "dropdown",
        },
      ],
      editor.getTextCursorPosition().block.id,
      "before",
    );
    },
    icon: <ListFilterIcon size={18} />,
    group: "Execute", // Match the group of regular var component
}); 