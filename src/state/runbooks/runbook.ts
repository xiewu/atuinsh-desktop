import { invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { uuidv7 } from "uuidv7";
import Workspace from "./workspace";
import Logger from "@/lib/logger";
import Snapshot from "./snapshot";
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
export type RunbookVisibility = "private" | "public" | "unlisted";

export interface RunbookAttrs {
  id: string;
  name: string;
  content: string;
  ydoc: Uint8Array | null;
  source: RunbookSource;
  sourceInfo: string | null;
  workspaceId: string;
  forkedFrom: string | null;
  remoteInfo: string | null;
  viewed_at: Date | null;

  created: Date;
  updated: Date;
}

export default class Runbook {
  id: string;
  ydoc: Uint8Array | null;
  source: RunbookSource;
  sourceInfo: string | null;
  remoteInfo: string | null;
  viewed_at: Date | null;

  created: Date;
  updated: Date;

  workspaceId: string;
  forkedFrom: string | null;

  private _name: string;
  private _content: string;

  set name(value: string) {
    if (value !== this._name) {
      this.updated = new Date();
      this._name = value;
    }
  }

  set content(value: string) {
    if (value !== this._content) {
      this.updated = new Date();
      this._content = value;
    }
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
    this.ydoc = attrs.ydoc || null;
    this.created = attrs.created;
    this.updated = attrs.updated;
    this.forkedFrom = attrs.forkedFrom;
    this.workspaceId = attrs.workspaceId;
    this.remoteInfo = attrs.remoteInfo;
    this.viewed_at = attrs.viewed_at || null;
  }

  /// Create a new Runbook, and automatically generate an ID.
  public static async create(workspace?: Workspace, persist: boolean = true): Promise<Runbook> {
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
      ydoc: null,
      created: now,
      updated: now,
      workspaceId: workspace.id,
      forkedFrom: null,
      remoteInfo: null,
      viewed_at: null,
    });

    if (persist) {
      await runbook.save();
    }

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
    remoteInfo: string | null,
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
      ydoc: null,
      created: new Date(obj.created),
      updated: new Date(),
      workspaceId: workspace.id,
      forkedFrom: null,
      remoteInfo: remoteInfo,
      viewed_at: null,
    });

    await runbook.save();

    return runbook;
  }

  public static async importFile(filePath: string) {
    // For some reason, we're getting an ArrayBuffer here? Supposedly it should be passing a string.
    // But it's not.
    let file = await readTextFile(filePath);
    var enc = new TextDecoder("utf-8");

    return Runbook.importJSON(JSON.parse(enc.decode(file as any)), "file", null, null);
  }

  public static async load(id: String): Promise<Runbook | null> {
    const db = await Database.load("sqlite:runbooks.db");

    let res = await logger.time(`Selecting runbook with ID ${id}`, async () =>
      db.select<any[]>(
        "select id, name, source, source_info, content, created, updated, " +
          "workspace_id, forked_from, remote_info, viewed_at from runbooks where id = $1",
        [id],
      ),
    );

    if (res.length == 0) return null;

    let rb = res[0];

    const doc: ArrayBuffer | null = await Runbook.loadYDocForRunbook(rb.id);
    rb.ydoc = doc;

    return Runbook.fromRow(rb);
  }

  static fromRow(row: any): Runbook {
    let update: Uint8Array | null = null;
    if (row.ydoc) {
      // For a short period of time, the `Y.Doc` might have been stored as a string.
      if (typeof row.ydoc == "string") {
        update = Uint8Array.from(JSON.parse(row.ydoc));
      } else if (row.ydoc.byteLength > 0) {
        update = new Uint8Array(row.ydoc);
      }
    }

    return new Runbook({
      id: row.id,
      name: row.name,
      source: row.source || "local",
      sourceInfo: row.sourceInfo,
      content: row.content || "[]",
      ydoc: update,
      created: new Date(row.created / 1000000),
      updated: new Date(row.updated / 1000000),
      workspaceId: row.workspace_id,
      forkedFrom: row.forked_from,
      remoteInfo: row.remote_info,
      viewed_at: row.viewed_at ? new Date(row.viewed_at / 1000000) : null,
    });
  }

  static async allInAllWorkspaces(): Promise<Runbook[]> {
    const db = await Database.load("sqlite:runbooks.db");

    let runbooks = await logger.time("Selecting all runbooks", async () => {
      let res = await db.select<any[]>(
        "select id, name, source, source_info, created, updated, workspace_id, forked_from, remote_info, viewed_at from runbooks " +
          "order by updated desc",
      );

      return res.map(Runbook.fromRow);
    });

    return runbooks;
  }

  static async allIdsInAllWorkspaces(): Promise<string[]> {
    const db = await Database.load("sqlite:runbooks.db");
    return logger.time("Selecting all runbook IDs", async () => {
      const rows = await db.select<{ id: string }[]>("select id from runbooks order by id desc");
      return rows.map((row) => row.id);
    });
  }

  // Default to scoping by workspace
  // Reduces the chance of accidents
  // If we ever need to fetch all runbooks for all workspaces, name it allInAllWorkspace or something
  static async all(workspace: Workspace): Promise<Runbook[]> {
    const db = await Database.load("sqlite:runbooks.db");

    let runbooks = await logger.time(
      `Selecting all runbooks for workspace ${workspace.id}`,
      async () => {
        let res = await db.select<any[]>(
          "select id, name, source, source_info, created, updated, workspace_id, forked_from, remote_info, viewed_at from runbooks " +
            "where workspace_id = $1 or workspace_id is null order by updated desc",
          [workspace.id],
        );

        return res.map(Runbook.fromRow);
      },
    );

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
        `insert into runbooks(id, name, content, created, updated, workspace_id, source, source_info, forked_from, remote_info, viewed_at)
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)

          on conflict(id) do update
            set
              name=$2,
              content=$3,
              updated=$5,
              workspace_id=$6,
              source=$7,
              source_info=$8,
              forked_from=$9,
              remote_info=$10,
              viewed_at=$11`,

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
          this.remoteInfo,
          this.viewed_at ? this.viewed_at.getTime() * 1000000 : null,
        ],
      );

      await Runbook.saveYDocForRunbook(this.id, this.ydoc);
      Runbook.invalidateCache(this.id);
    });
  }

  public async markViewed() {
    this.viewed_at = new Date();
    await this.save();
  }

  public static async loadYDocForRunbook(id: string) {
    const update: ArrayBuffer | null = await logger.time(
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

  public static async saveYDocForRunbook(id: string, update: ArrayBuffer | null) {
    if (update) {
      logger.time(`Saving Y.Doc for runbook ${id}...`, async () => {
        await invoke("save_ydoc_for_runbook", update, {
          headers: {
            id: id,
            db: "runbooks.db",
          },
        });
      });
    } else {
      logger.info("Skipping serialization of Y.Doc as content is null");
    }
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
      remoteInfo: this.remoteInfo,
      viewed_at: this.viewed_at,
    });
  }

  public static async delete(id: string) {
    const db = await Database.load("sqlite:runbooks.db");

    const p1 = db.execute("delete from runbooks where id=$1", [id]);
    const p2 = Snapshot.deleteForRunbook(id);
    await Promise.all([p1, p2]);
    Runbook.invalidateCache(id);
  }

  public static invalidateCache(id: string) {
    // Don't love this, but unsure the best way to invalidate the cache on save otherwise
    (window as any).queryClient.invalidateQueries(["runbook", id]);
  }
}
