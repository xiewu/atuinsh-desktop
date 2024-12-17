import { useEffect, useState, useMemo } from "react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";
import * as LanguageData from "@codemirror/language-data";

import CodeMirror, { Extension } from "@uiw/react-codemirror";

import "@xterm/xterm/css/xterm.css";
import Block from "../common/Block.tsx";
import { ChevronDownIcon, CodeIcon } from "lucide-react";
import {
  Dropdown,
  DropdownTrigger,
  Button,
  DropdownMenu,
  DropdownItem,
  Input,
} from "@nextui-org/react";

interface CodeBlockProps {
  onChange: (val: string) => void;
  onLanguageChange: (val: string) => void;
  code: string;
  language: string;
  isEditable: boolean;
}

const EditorBlock = ({
  onChange,
  code,
  language,
  onLanguageChange,
  isEditable,
}: CodeBlockProps) => {
  const languages = LanguageData.languages;
  const [extension, setExtension] = useState<Extension | null>(null);
  const [selected, setSelected] = useState<any | null>(
    languages.find((lang) => lang.name.toLowerCase() === language),
  );
  const [filterText, setFilterText] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredItems = useMemo(() => {
    return languages.filter((item) =>
      item.name.toLowerCase().includes(filterText.toLowerCase()),
    );
  }, [languages, filterText]);

  useEffect(() => {
    (async () => {
      if (!selected) return;
      onLanguageChange(selected.name.toLowerCase());
    })();
  }, [selected]);

  useEffect(() => {
    (async () => {
      let linfo = languages.find(
        (lang) => lang.name.toLowerCase() === language,
      );
      if (!linfo) return;

      let loaded = await linfo.load();

      setExtension(loaded.extension);
    })();
  }, [language]);

  return (
    <Block
      title="Editor"
      inlineHeader
      header={
        <div className="flex flex-row justify-between w-full">
          <h1 className="text-default-700 font-semibold">Editor</h1>
          <Dropdown
            isOpen={isOpen}
            onOpenChange={(open) => setIsOpen(open)}
            isDisabled={!isEditable}
          >
            <DropdownTrigger>
              <Button
                variant="flat"
                size="sm"
                className="capitalize"
                endContent={<ChevronDownIcon size={16} />}
              >
                {selected ? selected.name : "Select a language"}
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Scrollable dropdown"
              className="max-h-[300px] overflow-y-auto"
              items={filteredItems}
              topContent={
                <Input
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                  type="text"
                  placeholder="Filter languages..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  className="w-full"
                  onClick={(e) => e.stopPropagation()}
                  disabled={!isEditable}
                />
              }
            >
              {(item) => (
                <DropdownItem
                  key={item.name}
                  onPress={() => {
                    setSelected(item);
                    setFilterText("");
                    setIsOpen(false);
                  }}
                >
                  {item.name}
                </DropdownItem>
              )}
            </DropdownMenu>
          </Dropdown>
        </div>
      }
    >
      <CodeMirror
        className="!pt-0 max-w-full border border-gray-300 rounded flex-grow max-h-1/2 overflow-scroll"
        placeholder={"Write some code..."}
        value={code}
        editable={isEditable}
        onChange={(val) => {
          onChange(val);
        }}
        extensions={extension ? [extension] : []}
        basicSetup={true}
      />
    </Block>
  );
};

export default createReactBlockSpec(
  {
    type: "editor",
    propSchema: {
      code: { default: "" },
      language: { default: "" },
    },
    content: "none",
  },
  {
    // @ts-ignore
    render: ({ block, editor, code, type }) => {
      const onCodeChange = (val: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, code: val },
        });
      };

      const onLanguageChange = (val: string) => {
        editor.updateBlock(block, {
          // @ts-ignore
          props: { ...block.props, language: val },
        });
      };

      return (
        <EditorBlock
          onChange={onCodeChange}
          onLanguageChange={onLanguageChange}
          code={block.props.code}
          language={block.props.language}
          isEditable={editor.isEditable}
        />
      );
    },
    toExternalHTML: ({ block }) => {
      return (
        <pre>
          <code>{block?.props?.code}</code>
        </pre>
      );
    },
  },
);

export const insertEditor =
  (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
    title: "Editor",
    onItemClick: () => {
      insertOrUpdateBlock(editor, {
        type: "editor",
      });
    },
    icon: <CodeIcon size={18} />,
    group: "Misc",
    aliases: ["code"],
  });
