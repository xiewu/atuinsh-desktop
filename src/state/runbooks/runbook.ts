import { save } from "@tauri-apps/plugin-dialog";
import Database from "@tauri-apps/plugin-sql";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import * as Y from "yjs";
import { uuidv7 } from "uuidv7";
import Workspace from "./workspace";
import Logger from "@/lib/logger";
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

export default class Runbook {
  id: string;

  created: Date;
  updated: Date;

  workspaceId: string;

  private _name: string;
  private _content: string;
  private _ydoc: Y.Doc;

  set name(value: string) {
    this.updated = new Date();
    this._name = value;
  }

  set content(value: string) {
    this.updated = new Date();
    this._content = value;
  }

  get ydoc() {
    return this._ydoc;
  }

  get content() {
    return this._content;
  }

  get name() {
    return this._name;
  }

  constructor(
    id: string,
    name: string,
    content: string,
    ydoc: Y.Doc,
    created: Date,
    updated: Date,
    workspaceId: string,
  ) {
    this.id = id;
    this._name = name;
    this._content = content;
    this._ydoc = ydoc;
    this.created = created;
    this.updated = updated;

    this.workspaceId = workspaceId;
  }

  /// Create a new Runbook, and automatically generate an ID.
  public static async create(workspace?: Workspace): Promise<Runbook> {
    let now = new Date();

    if (workspace === undefined || workspace === null) {
      workspace = await Workspace.current();
    }

    // Initialize with the same value for created/updated, to avoid needing null.
    let runbook = new Runbook(
      uuidv7(),
      "",
      "",
      new Y.Doc(),
      now,
      now,
      workspace.id,
    );
    await runbook.save();

    return runbook;
  }

  public static async count(): Promise<number> {
    const db = await Database.load("sqlite:runbooks.db");
    let res = await db.select<any[]>("select count(1) as count from runbooks");

    return res[0]["count"];
  }

  public async export() {
    let filePath = await save({
      defaultPath: this.name + ".atrb",
    });

    if (!filePath) return;
    let exportFile: RunbookFile = {
      version: 0,
      id: this.id,
      name: this.name,
      created: this.created,
      content: this.content,
    };

    await writeTextFile(filePath, JSON.stringify(exportFile));
  }

  public static async importJSON(
    obj: RunbookFile,
    workspace?: Workspace,
  ): Promise<Runbook> {
    if (workspace === undefined || workspace === null) {
      workspace = await Workspace.current();
    }

    let runbook = new Runbook(
      obj.id,
      obj.name,
      obj.content,
      new Y.Doc(),
      new Date(obj.created),
      new Date(),
      workspace.id,
    );

    await runbook.save();

    return runbook;
  }

  public static async importFile(filePath: string, workspace?: Workspace) {
    let file = await readTextFile(filePath);
    let importFile = JSON.parse(file) as RunbookFile;

    return Runbook.importJSON(importFile, workspace);
  }

  public static async load(id: String): Promise<Runbook | null> {
    const db = await Database.load("sqlite:runbooks.db");

    const start = performance.now();
    let res = await db.select<any[]>("select * from runbooks where id = $1", [
      id,
    ]);
    const end = performance.now();
    const delta = end - start;
    logger.debug(`Selecing a runbook (${id}):`, delta);

    if (res.length == 0) return null;

    let rb = res[0];

    return Runbook.fromRow(rb);
  }

  static fromRow(row: any): Runbook {
    let doc = new Y.Doc();

    if (row.ydoc) {
      const start = performance.now();
      const update = Uint8Array.from(JSON.parse(row.ydoc));
      Y.applyUpdate(doc, update);
      const end = performance.now();
      const delta = end - start;
      logger.debug("Converting Y.Doc from JSON", delta);
    }

    return new Runbook(
      row.id,
      row.name,
      row.content,
      doc,
      new Date(row.created / 1000000),
      new Date(row.updated / 1000000),
      row.workspace_id,
    );
  }

  // Default to scoping by workspace
  // Reduces the chance of accidents
  // If we ever need to fetch all runbooks for all workspaces, name it allInAllWorkspace or something
  static async all(workspace: Workspace): Promise<Runbook[]> {
    const db = await Database.load("sqlite:runbooks.db");

    const start = performance.now();
    let res = await db.select<any[]>(
      // "select * from runbooks where workspace_id = $1 or workspace_id is null order by updated desc",
      "select id, name, content, created, updated, workspace_id from runbooks where workspace_id = $1 or workspace_id is null order by updated desc",
      [workspace.id],
    );
    const end = performance.now();
    const delta = end - start;
    logger.debug("Selecing all runbooks:", delta);

    let runbooks = res.map(Runbook.fromRow);

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

    const ydocAsUpdate = Y.encodeStateAsUpdate(this.ydoc);

    await db.execute(
      `insert into runbooks(id, name, content, created, updated, workspace_id, ydoc)
          values ($1, $2, $3, $4, $5, $6, $7)

          on conflict(id) do update
            set
              name=$2,
              content=$3,
              updated=$5,
              workspace_id=$6,
              ydoc=$7`,

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
        // Convert the Uint8Array to a regular array so that it can be serialized
        Array.from(ydocAsUpdate),
      ],
    );
  }

  public async moveTo(workspace: Workspace) {
    this.workspaceId = workspace.id;
    await this.save();
  }

  public static async delete(id: string) {
    const db = await Database.load("sqlite:runbooks.db");

    await db.execute("delete from runbooks where id=$1", [id]);
  }
}
