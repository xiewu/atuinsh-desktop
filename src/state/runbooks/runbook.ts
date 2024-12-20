import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import * as Y from "yjs";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { uuidv7 } from "uuidv7";
import Workspace from "./workspace";
import Logger from "@/lib/logger";
import { atuinToBlocknote, blocknoteToAtuin } from "./convert";
const logger = new Logger("Runbook", "green", "green");

// Definition of an atrb file
// This is JSON encoded for ease of access, and may change in the future
export interface RunbookFile {
  version: number;

  id: string;
  name: string;
  created: Date;
  slug?: string;

  content: string;
}

type RunbookSource = "local" | "hub" | "file";

export interface RunbookAttrs {
  id: string;
  name: string;
  content: string;
  ydoc: Y.Doc;
  source: RunbookSource;
  sourceInfo: string | null;
  workspaceId: string;
  forkedFrom: string | null;

  created: Date;
  updated: Date;
}

export default class Runbook {
  id: string;
  ydoc: Y.Doc;
  source: RunbookSource;
  sourceInfo: string | null;

  created: Date;
  updated: Date;

  workspaceId: string;
  forkedFrom: string | null;

  private _name: string;
  private _content: string;

  set name(value: string) {
    this.updated = new Date();
    this._name = value;
  }

  set content(value: string) {
    this.updated = new Date();
    this._content = value;
  }

  get content() {
    return this._content;
  }

  get name() {
    return this._name;
  }

  constructor(attrs: RunbookAttrs) {
    this.id = attrs.id;
    this._name = attrs.name;
    this.source = attrs.source || "local";
    this.sourceInfo = attrs.sourceInfo;
    this._content = attrs.content;
    this.ydoc = attrs.ydoc;
    this.created = attrs.created;
    this.updated = attrs.updated;
    this.forkedFrom = attrs.forkedFrom;
    this.workspaceId = attrs.workspaceId;
  }

  /// Create a new Runbook, and automatically generate an ID.
  public static async create(workspace?: Workspace): Promise<Runbook> {
    let now = new Date();

    if (workspace === undefined || workspace === null) {
      workspace = await Workspace.current();
    }

    // Initialize with the same value for created/updated, to avoid needing null.
    let runbook = new Runbook({
      id: uuidv7(),
      name: "",
      source: "local",
      sourceInfo: null,
      content: "",
      ydoc: new Y.Doc(),
      created: now,
      updated: now,
      workspaceId: workspace.id,
      forkedFrom: null,
    });
    await runbook.save();

    return runbook;
  }

  public static async count(): Promise<number> {
    const db = await Database.load("sqlite:runbooks.db");
    let res = await db.select<any[]>("select count(1) as count from runbooks");

    return res[0]["count"];
  }

  public async export(filePath: string) {
    // Load the runbook from the ID. This ensures we have all fields populated properly, and as up-to-date as possible.
    // TODO: we are probably going to be changing stuff here for snapshots
    let rb = await Runbook.load(this.id);
    if (!rb) return;

    let content = blocknoteToAtuin(JSON.parse(rb.content));
    let runbook = {
      version: 0,
      id: this.id,
      name: this.name,
      created: this.created.getTime() * 1000000,
      content: content,
    };

    await invoke<string>("export_atrb", {
      json: JSON.stringify(runbook),
      filePath: filePath,
    });
  }

  public async exportMarkdown(filePath: string) {
    let blocks = blocknoteToAtuin(JSON.parse(this.content));
    await invoke<string>("export_atmd", {
      json: JSON.stringify(blocks),
      path: filePath,
    });
  }

  public static async importJSON(
    obj: RunbookFile,
    source: RunbookSource,
    sourceInfo: string | null,
    workspace?: Workspace,
  ): Promise<Runbook> {
    if (workspace === undefined || workspace === null) {
      workspace = await Workspace.current();
    }

    let content = typeof obj.content === "object" ? obj.content : JSON.parse(obj.content);
    let mappedContent = atuinToBlocknote(content);

    let runbook = new Runbook({
      id: obj.id,
      name: obj.name,
      source: source,
      sourceInfo: sourceInfo,
      content: JSON.stringify(mappedContent),
      ydoc: new Y.Doc(),
      created: new Date(obj.created),
      updated: new Date(),
      workspaceId: workspace.id,
      forkedFrom: null,
    });

    await runbook.save();

    return runbook;
  }

  public static async importFile(filePath: string) {
    // For some reason, we're getting an ArrayBuffer here? Supposedly it should be passing a string.
    // But it's not.
    let file = await readTextFile(filePath);
    var enc = new TextDecoder("utf-8");

    // Because of the aforemention thing.
    // @ts-ignore
    return Runbook.importJSON(JSON.parse(enc.decode(file)));
  }

  public static async load(id: String): Promise<Runbook | null> {
    const db = await Database.load("sqlite:runbooks.db");

    let res = await logger.time(`Selecting runbook with ID ${id}`, async () =>
      db.select<any[]>(
        "select id, name, source, source_info, content, created, updated, workspace_id, forked_from from runbooks where id = $1",
        [id],
      ),
    );

    if (res.length == 0) return null;

    let rb = res[0];

    const doc: ArrayBuffer = await Runbook.loadYDocForRunbook(rb.id);
    rb.ydoc = doc;

    return Runbook.fromRow(rb);
  }

  static fromRow(row: any): Runbook {
    let doc = new Y.Doc();

    if (row.ydoc) {
      let update;
      // For a short period of time, the `Y.Doc` might have been stored as a string.
      if (typeof row.ydoc == "string") {
        update = Uint8Array.from(JSON.parse(row.ydoc));
      } else if (row.ydoc.byteLength > 0) {
        update = new Uint8Array(row.ydoc);
      }

      if (update) {
        Y.applyUpdate(doc, update);
      }
    }

    return new Runbook({
      id: row.id,
      name: row.name,
      source: row.source || "local",
      sourceInfo: row.sourceInfo,
      content: row.content || "[]",
      ydoc: doc,
      created: new Date(row.created / 1000000),
      updated: new Date(row.updated / 1000000),
      workspaceId: row.workspace_id,
      forkedFrom: row.forked_from,
    });
  }

  // Default to scoping by workspace
  // Reduces the chance of accidents
  // If we ever need to fetch all runbooks for all workspaces, name it allInAllWorkspace or something
  static async all(workspace: Workspace): Promise<Runbook[]> {
    const db = await Database.load("sqlite:runbooks.db");

    let runbooks = await logger.time("Selecting all runbooks", async () => {
      let res = await db.select<any[]>(
        "select id, name, source, source_info, created, updated, workspace_id, forked_from from runbooks " +
          "where workspace_id = $1 or workspace_id is null order by updated desc",
        [workspace.id],
      );

      return res.map(Runbook.fromRow);
    });

    let currentWorkspace = await Workspace.current();

    // Handle migrations
    for (let rb of runbooks) {
      // Workspaces didn't exist to start with,
      // so for some users could be null
      if (rb.workspaceId === null || rb.workspaceId === undefined) {
        rb.workspaceId = currentWorkspace.id;

        await rb.save();
      }
    }

    return runbooks;
  }

  public async save() {
    const db = await Database.load("sqlite:runbooks.db");

    logger.time(`Saving runbook ${this.id}`, async () => {
      await db.execute(
        `insert into runbooks(id, name, content, created, updated, workspace_id, source, source_info, forked_from)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9)

          on conflict(id) do update
            set
              name=$2,
              content=$3,
              updated=$5,
              workspace_id=$6,
              source=$7,
              source_info=$8,
              forked_from=$9`,

        // getTime returns a timestamp as unix milliseconds
        // we won't need or use the resolution here, but elsewhere Atuin stores timestamps in sqlite as nanoseconds since epoch
        // let's do that across the board to avoid mistakes
        [
          this.id,
          this._name,
          this._content,
          this.created.getTime() * 1000000,
          this.updated.getTime() * 1000000,
          this.workspaceId,
          this.source,
          this.sourceInfo,
          this.forkedFrom,
        ],
      );

      const ydocAsUpdate = Y.encodeStateAsUpdate(this.ydoc);
      await Runbook.saveYDocForRunbook(this.id, ydocAsUpdate);
    });
  }

  public static async loadYDocForRunbook(id: string) {
    const update: ArrayBuffer = await logger.time(
      `Loading Y.Doc for runbook ${id}...`,
      async () => {
        return await invoke("load_ydoc_for_runbook", {
          runbookId: id,
          dbPath: "runbooks.db",
        });
      },
    );

    return update;
  }

  public static async saveYDocForRunbook(id: string, update: ArrayBuffer) {
    logger.time(`Saving Y.Doc for runbook ${id}...`, async () => {
      await invoke("save_ydoc_for_runbook", update, {
        headers: {
          id: id,
          db: "runbooks.db",
        },
      });
    });
  }

  public async moveTo(workspace: Workspace) {
    this.workspaceId = workspace.id;
    await this.save();
  }

  public clone() {
    return new Runbook({
      id: this.id,
      name: this.name,
      source: this.source,
      sourceInfo: this.sourceInfo,
      content: this.content,
      ydoc: this.ydoc,
      created: this.created,
      updated: this.updated,
      workspaceId: this.workspaceId,
      forkedFrom: this.forkedFrom,
    });
  }

  public static async delete(id: string) {
    const db = await Database.load("sqlite:runbooks.db");

    await db.execute("delete from runbooks where id=$1", [id]);
  }
}
