import * as Y from "yjs";
import ReactDOM from "react-dom/client";
import { BlockNoteView } from "@blocknote/mantine";
import debounce from "lodash.debounce";
import { createConversionEditor } from "@/components/runbooks/editor/create_editor";
import { Block } from "@blocknote/core";

export function ydocToBlocknote(doc: Y.Doc): Promise<Block<any>[]> {
  return new Promise((resolve) => {
    const fragment = doc.getXmlFragment("document-store");
    const editor = createConversionEditor(fragment);

    const el = document.createElement("div");
    const root = ReactDOM.createRoot(el);

    const onChange = debounce(() => {
      resolve(editor.document);
      root.unmount();
    }, 1000);

    root.render(<BlockNoteView editor={editor} editable={false} onChange={onChange} />);
  });
}
