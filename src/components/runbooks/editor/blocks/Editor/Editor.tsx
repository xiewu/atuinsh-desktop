import { useEffect, useState, useMemo } from "react";

// @ts-ignore
import { createReactBlockSpec } from "@blocknote/react";
import { insertOrUpdateBlock } from "@blocknote/core";
import * as themes from "@uiw/codemirror-themes-all";
import * as LanguageData from "@codemirror/language-data";
import EditorBlockType from "@/lib/workflow/blocks/editor.ts";
import track_event from "@/tracking";

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
} from "@heroui/react";
import EditableHeading from "@/components/EditableHeading/index.tsx";

// Extra languages
// Note that the languagedata package handles the dynamic loading of languages. This is different,
// as by importing it we have already loaded it. Not really a big deal for our use case.
import { hcl } from "codemirror-lang-hcl";
import { useStore } from "@/state/store.ts";
import { DependencySpec } from "@/lib/workflow/dependency.ts";

interface LanguageLoader {
  name: string;
  extension: () => Promise<Extension>;
}

// Seeing as we now have a mix of _custom_ languages, and also teh default languages, we use this to generate
// a cohesive list of languages with a consistent interface.
function languageLoaders(): LanguageLoader[] {
  // Build an array of language loaders, first of the default languages
  let languages = LanguageData.languages.map((lang) => {
    return {
      name: lang.name,
      extension: async () => {
        let loaded = await lang.load();
        return loaded.extension;
      },
    };
  });

  // then append the custom languages
  languages.push({
    name: "HCL",
    extension: async () => hcl(),
  });

  // sort it alphabetically by name
  return languages.toSorted((a, b) => a.name.localeCompare(b.name));
}

interface CodeBlockProps {
  name: string;
  setName: (name: string) => void;
  editor: EditorBlockType;

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
  name,
  setName,
  editor,
}: CodeBlockProps) => {
  const colorMode = useStore((state) => state.functionalColorMode);
  const languages: LanguageLoader[] = useMemo(() => languageLoaders(), []);

  const [extension, setExtension] = useState<Extension | null>(null);
  const [selected, setSelected] = useState<any | null>(
    languages.find((lang) => lang.name.toLowerCase() === language),
  );
  const [filterText, setFilterText] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredItems = useMemo(() => {
    return languages
      .filter((item) => item.name.toLowerCase().includes(filterText.toLowerCase()))
      .toSorted((a, b) => a.name.localeCompare(b.name));
  }, [languages, filterText]);

  useEffect(() => {
    (async () => {
      if (!selected) return;
      onLanguageChange(selected.name.toLowerCase());
    })();
  }, [selected]);

  useEffect(() => {
    (async () => {
      let linfo = languages.find((lang) => lang.name.toLowerCase() === language);
      if (!linfo) return;

      let extension = await linfo.extension();

      setExtension(extension);
    })();
  }, [language]);

  const lightModeEditorTheme = useStore((state) => state.lightModeEditorTheme);
  const darkModeEditorTheme = useStore((state) => state.darkModeEditorTheme);
  const theme = useMemo(() => {
    return colorMode === "dark" ? darkModeEditorTheme : lightModeEditorTheme;
  }, [colorMode, lightModeEditorTheme, darkModeEditorTheme]);

  const themeObj = (themes as any)[theme];

  return (
    <Block
      name={name}
      block={editor}
      type={editor.typeName}
      setDependency={() => {}}
      setName={setName}
      inlineHeader
      header={
        <div className="flex flex-row justify-between w-full">
          <EditableHeading initialText={name} onTextChange={setName} />
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
        readOnly={!isEditable}
        onChange={(val) => {
          onChange(val);
        }}
        extensions={extension ? [extension] : []}
        basicSetup={true}
        theme={themeObj}
      />
    </Block>
  );
};

export default createReactBlockSpec(
  {
    type: "editor",
    propSchema: {
      name: { default: "Editor" },
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

      const setName = (name: string) => {
        editor.updateBlock(block, {
          props: { ...block.props, name: name },
        });
      };

      // The editor block cannot have a dependency, because it is not runnable.
      // TODO(ellie): a more elegant way of expressing this
      let editorBlock = new EditorBlockType(
        block.id,
        block.props.name,
        DependencySpec.empty(),
        block.props.code,
        block.props.language,
      );

      return (
        <EditorBlock
          name={block.props.name}
          editor={editorBlock}
          setName={setName}
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

export const insertEditor = (schema: any) => (editor: typeof schema.BlockNoteEditor) => ({
  title: "Editor",
  onItemClick: () => {
    track_event("runbooks.block.create", { type: "editor" });
    
    let editorBlocks = editor.document.filter((block: any) => block.type === "editor");
    let name = `Editor ${editorBlocks.length + 1}`;

    insertOrUpdateBlock(editor, {
      type: "editor",
      // @ts-ignore
      props: {
        name: name,
      },
    });
  },
  icon: <CodeIcon size={18} />,
  group: "Misc",
  aliases: ["code"],
});
