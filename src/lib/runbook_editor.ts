import { User } from "@/state/models";
import Runbook from "@/state/runbooks/runbook";
import { BlockNoteEditor } from "@blocknote/core";
import track_event from "@/tracking";
import * as Y from "yjs";
import PhoenixProvider, { PresenceUserInfo } from "./phoenix_provider";
import {
  createBasicEditor,
  createCollaborativeEditor,
} from "@/components/runbooks/editor/create_editor";
import { randomColor } from "./colors";
import Logger from "./logger";
import Snapshot from "@/state/runbooks/snapshot";

const SAVE_DEBOUNCE = 1000;

function isContentBlank(content: any) {
  return (
    content.length === 1 &&
    content[0].content.length === 0 &&
    content[0].type === "paragraph" &&
    content[0].id === "initialBlockId"
  );
}

export default class RunbookEditor {
  public runbook: Runbook;
  private user: User;
  private selectedTag: string;
  private onPresenceJoin: (user: PresenceUserInfo) => void;
  private onPresenceLeave: (user: PresenceUserInfo) => void;
  private yDoc: Y.Doc;

  private editor: Promise<BlockNoteEditor> | null = null;
  private provider: PhoenixProvider | null = null;

  private logger: Logger;
  private saveTimer: number | null = null;
  private saveArgs: [Runbook | undefined, BlockNoteEditor] | null = null;
  private isShutdown = false;

  constructor(
    runbook: Runbook,
    user: User,
    selectedTag: string | null,
    onPresenceJoin: (user: PresenceUserInfo) => void,
    onPresenceLeave: (user: PresenceUserInfo) => void,
  ) {
    this.logger = new Logger(`RunbookEditor (${runbook.id})`, "black", "white");
    this.runbook = runbook;
    this.user = user;
    this.selectedTag = selectedTag || "latest";
    this.onPresenceJoin = onPresenceJoin;
    this.onPresenceLeave = onPresenceLeave;
    this.yDoc = new Y.Doc();
    if (this.runbook.ydoc) {
      Y.applyUpdate(this.yDoc, this.runbook.ydoc);
    }
  }

  updateRunbook(runbook: Runbook) {
    if (runbook.id !== this.runbook.id) {
      throw new Error("Can only update runbook with runbook of same ID");
    }

    this.runbook = runbook;
  }

  async updateUser(user: User) {
    if (this.user.is(user)) return;
    this.user = user;
    if (!this.editor) return;

    const editor = await this.editor;
    const extension: any = editor.extensions.collaborationCursor;
    if (extension) {
      extension.options.user.name = user.username || "Anonymous";
    }
  }

  updateSelectedTag(tag: string | null) {
    tag = tag || "latest";
    if (tag === this.selectedTag) return;

    this.editor = null;
    if (tag !== "latest") {
      this.flushSave();
      this.provider?.shutdown();
      this.provider = null;
    }
    this.selectedTag = tag;
  }

  getEditor(): Promise<BlockNoteEditor> {
    if (this.editor) return this.editor;

    this.editor = new Promise(async (resolve) => {
      // If viewing a tag, we just want a basic, no-frills editor
      if (this.selectedTag && this.selectedTag !== "latest") {
        const snapshot = await Snapshot.findByRunbookIdAndTag(this.runbook.id, this.selectedTag);
        if (!snapshot) {
          throw new Error(`Could not find snapshot based on tag: ${this.selectedTag}`);
        }
        const editor = createBasicEditor(JSON.parse(snapshot.content));
        resolve(editor as any as BlockNoteEditor);
        return;
      }

      const presenceColor = randomColor();

      const provider = new PhoenixProvider(this.runbook.id, this.yDoc, presenceColor);
      this.provider = provider;
      const editor = createCollaborativeEditor(provider, this.user, presenceColor);

      const content = JSON.parse(this.runbook.content || "[]");
      // convert any block of type sql -> sqlite
      for (var i = 0; i < content.length; i++) {
        if (content[i].type == "sql") {
          content[i].type = "sqlite";
        }
      }

      provider.on("remote_update", () => {
        this.save(this.runbook, editor as any as BlockNoteEditor);
      });

      provider.on("presence:join", this.onPresenceJoin);
      provider.on("presence:leave", this.onPresenceLeave);

      provider.once("synced").then(() => {
        // If the loaded YJS doc has no content, and the server has no content,
        // we should take the old `content` field (if any) and populate the editor
        // so that we trigger a save, creating the YJS document.
        //
        // This doesn't work if we set the content on the same tick, so defer it.
        setTimeout(() => {
          let currentContent = editor.document;

          if (isContentBlank(currentContent) && !this.isShutdown) {
            this.logger.info(
              "BlockNote editor has empty content after sync; inserting existing content.",
              currentContent,
              content,
            );

            editor.replaceBlocks(currentContent, content);
          }
        }, 100);
        resolve(editor as any as BlockNoteEditor);
      });
    });

    return this.editor;
  }

  fetchName(blocks: any[]): string {
    // Infer the title from the first text block
    for (const block of blocks) {
      if (block.type == "heading" || block.type == "paragraph") {
        if (block.content.length == 0) continue;
        // @ts-ignore
        if (block.content[0].text.length == 0) continue;

        let name = block.content.filter((i: any) => i.type === "text").map((i: any) => i.text);

        // @ts-ignore
        return name.join(" ");
      }
    }

    return "Untitled";
  }

  save(runbook: Runbook | undefined, editor: BlockNoteEditor) {
    // Don't allow `onChange` events from BlockNote to fire a save
    // if we're viewing a tag
    if (this.selectedTag !== "latest") return;

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveArgs = [runbook, editor];
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveArgs = null;
      this._save(runbook, editor);
    }, SAVE_DEBOUNCE);
  }

  flushSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    if (this.saveArgs) {
      this._save(...this.saveArgs);
      this.saveArgs = null;
    }
  }

  async _save(runbookArg: Runbook | undefined, editorArg: BlockNoteEditor) {
    if (!runbookArg) return;
    if (runbookArg?.id !== this.runbook.id) {
      this.logger.warn(
        "Runbook from args not the same as runbook from container",
        runbookArg?.id,
        this.runbook.id,
      );
      return;
    }
    const editor = await this.editor;
    if (editorArg !== editor) {
      this.logger.warn("Editor from args not the same as editor from container");
      return;
    }
    // if (!editable) return; // TODO

    Runbook.count().then((num) => {
      track_event("runbooks.save", { total: num });
    });

    this.runbook.name = this.fetchName(editor.document);
    this.runbook.content = JSON.stringify(editor.document);
    this.runbook.ydoc = Y.encodeStateAsUpdate(this.yDoc);

    return this.runbook.save();
  }

  shutdown() {
    this.isShutdown = true;
    this.provider?.shutdown();
    this.flushSave();
  }
}
