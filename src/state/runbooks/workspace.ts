import Database from "@tauri-apps/plugin-sql";
import { KVStore } from "../kv";
import { uuidv7 } from "uuidv7";
import Runbook from "./runbook";

class WorkspaceMeta {
  totalRunbooks: number;

  constructor(totalRunbooks: number) {
    this.totalRunbooks = totalRunbooks;
  }

  static async load(workspace_id: string): Promise<WorkspaceMeta> {
    // Load the meta for the workspace.
    // This is a separate class to keep the workspace class clean.
    const db = await Database.load("sqlite:runbooks.db");

    let runbookCount = await db.select<any[]>("select count(*) as count from runbooks where workspace_id = ?", [workspace_id]);

    return new WorkspaceMeta(runbookCount[0].count);
  }
}

export default class Workspace {
  id: string;
  name: string;


  created: Date;
  updated: Date;

  meta: WorkspaceMeta | null;
  watchDir: string | null;

  constructor(id: string, name: string, created: Date, updated: Date, watchDir: string | null = null) {
    this.id = id;
    this.name = name;
    this.created = created;
    this.updated = updated;
    this.watchDir = watchDir;

    this.meta = null;
  }

  static async create(name: string): Promise<Workspace> {
    let id = uuidv7();
    let workspace = new Workspace(id, name, new Date(), new Date());

    const db = await Database.load("sqlite:runbooks.db");
    await db.execute("insert into workspaces (id, name, created, updated) VALUES (?, ?, ?, ?)", [workspace.id, workspace.name, workspace.created, workspace.updated]);

    return workspace;
  }

  async delete() {
    const db = await Database.load("sqlite:runbooks.db");

    // First, delete all runbooks belonging to this workspace.
    let runbooks = await this.runbooks();

    for (let runbook of runbooks) {
      await Runbook.delete(runbook.id);
    }

    await db.execute("delete from workspaces where id = ?", [this.id]);
  }

  static async findById(id: string): Promise<Workspace | null> {
    const db = await Database.load("sqlite:runbooks.db");

    let row = await db.select<any[]>("select * from workspaces where id = ?", [id]);
    if (row == null) {
      return null;
    }

    return new Workspace(row[0].id, row[0].name, row[0].created, row[0].updated);
  }

  static async current(): Promise<Workspace> {
    // Get the current workspace.
    // If there is no current workspace, create one.
    const kv = await KVStore.open_default();

    let current_workspace = await kv.get("current_workspace");

    if (current_workspace == null) {
      let ws = await Workspace.create("Default Workspace");
      await kv.set("current_workspace", ws.id);

      return ws;
    }

    let ws = await Workspace.findById(current_workspace);

    if (ws == null) {
      throw new Error("Current workspace not found");
    }

    return ws;
  }

  static async all(): Promise<Workspace[]> {
    const db = await Database.load("sqlite:runbooks.db");
    let rows = await db.select<any[]>("select * from workspaces");

    return rows.map((row) => {
      let ws = new Workspace(row.id, row.name, row.created, row.updated);

      return ws;
    });
  }

  static async count(): Promise<number> {
    const db = await Database.load("sqlite:runbooks.db");
    let res = await db.select<any[]>("select count(1) as count from workspaces");

    return res[0]["count"];
  }

  async refreshMeta() {
    let meta = await WorkspaceMeta.load(this.id);
    this.meta = meta;
  }

  async rename(name: string) {
    this.name = name;

    const db = await Database.load("sqlite:runbooks.db");
    await db.execute("update workspaces set name = ?, updated = ? where id = ?", [this.name, new Date(), this.id]);
  }

  async runbooks(): Promise<Runbook[]> {
    const db = await Database.load("sqlite:runbooks.db");
    let rows = await db.select<any[]>("select * from runbooks where workspace_id = ? order by updated desc", [this.id]);
    let runbooks = rows.map(Runbook.fromRow);

    return runbooks;
  }

  async setWatchDir(dir: string) {
    this.watchDir = dir;

    const db = await Database.load("sqlite:runbooks.db");
    await db.execute("update workspaces set watch_dir = ? where id = ?", [this.watchDir, this.id]);
  }
}
