import CodeMirror, { Command, keymap, Prec } from "@uiw/react-codemirror";
import * as themes from "@uiw/codemirror-themes-all";
import { langs } from "@uiw/codemirror-extensions-langs";
import { extensions } from "./extensions";
import { useMemo } from "react";
import { acceptCompletion } from "@codemirror/autocomplete";

interface KeyMap {
  key?: string;
  mac?: string;
  run: Command;
}

interface CodeEditorProps {
  id: string;
  code: string;
  isEditable: boolean;
  language: string;
  theme: string;
  keyMap?: KeyMap[];
  onChange: (code: string) => void;
}

export const TabAutoComplete: KeyMap = { key: "Tab", run: acceptCompletion };

export default function CodeEditor({
  id,
  code,
  isEditable,
  onChange,
  language,
  theme,
  keyMap,
}: CodeEditorProps) {
  let editorLanguage = useMemo(() => {
    // Do the best we can with the interpreter name - get the language
    // TODO: consider dropdown to override this
    if (
      language.indexOf("bash") != -1 ||
      language.indexOf("sh") != -1 ||
      language.indexOf("zsh") != -1
    ) {
      return langs.shell();
    }

    if (language.indexOf("python") != -1) {
      return langs.python();
    }

    if (
      language.indexOf("node") != -1 ||
      language.indexOf("js") != -1 ||
      language.indexOf("bun") != -1 ||
      language.indexOf("deno") != -1
    ) {
      return langs.python();
    }

    if (language.indexOf("lua") != -1) {
      return langs.lua();
    }

    if (language.indexOf("ruby") != -1) {
      return langs.ruby();
    }

    return null;
  }, [language]);

  const customKeymap = Prec.highest(keymap.of(keyMap || [TabAutoComplete]));
  const themeObj = (themes as any)[theme];

  let editorExtensions: any[] = useMemo(() => {
    return [...extensions(), editorLanguage, customKeymap];
  }, [editorLanguage, customKeymap]);

  return (
    <CodeMirror
      id={id}
      placeholder={"Write your code here..."}
      className="!pt-0 max-w-full border border-gray-300 rounded flex-grow"
      value={code}
      editable={isEditable}
      onChange={(val) => {
        onChange(val);
      }}
      extensions={editorExtensions}
      basicSetup={false}
      indentWithTab={false}
      theme={themeObj}
    />
  );
}
