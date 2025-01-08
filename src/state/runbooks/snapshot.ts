import { uuidv7 } from "uuidv7";
import AtuinDB from "../atuin_db";

export interface SnapshotAttrs {
  id?: string;
  tag: string;
  runbook_id: string;
  content: string;
  created?: Date;
}

export default class Snapshot {
  id: string;
  tag: string;
  runbook_id: string;
  content: string;

  created: Date;

  constructor(attrs: SnapshotAttrs) {
    this.id = attrs.id || uuidv7();
    this.tag = attrs.tag;
    this.runbook_id = attrs.runbook_id;
    this.content = attrs.content;
    this.created = attrs.created || new Date();
  }

  static async create(attrs: SnapshotAttrs): Promise<Snapshot> {
    const id = attrs.id || uuidv7();
    const fullAttrs = {
      id,
      tag: attrs.tag,
      runbook_id: attrs.runbook_id,
      content: attrs.content,
      created: attrs.created || new Date(),
    };
    let snapshot = new Snapshot(fullAttrs);

    const db = await AtuinDB.load("runbooks");
    await db.execute(
      "insert into snapshots (id, tag, runbook_id, content, created) VALUES (?, ?, ?, ?, ?)",
      [snapshot.id, snapshot.tag, snapshot.runbook_id, snapshot.content, snapshot.created],
    );

    return snapshot;
  }

  static async get(id: string): Promise<Snapshot | null> {
    const db = await AtuinDB.load("runbooks");

    let row = await db.select<Snapshot[]>("select * from snapshots where id = ?", [id]);

    if (row == null) {
      return null;
    }

    const attrs = row[0];
    return new Snapshot(attrs);
  }

  static async findByRunbookId(runbook_id: string): Promise<Snapshot[]> {
    const db = await AtuinDB.load("runbooks");
    let rows = await db.select<Snapshot[]>(
      "select * from snapshots where runbook_id = ? order by created desc, tag desc",
      [runbook_id],
    );

    return rows.map((row) => {
      let snap = new Snapshot(row);

      return snap;
    });
  }

  static async findByRunbookIdAndTag(runbook_id: string, tag: string): Promise<Snapshot | null> {
    const db = await AtuinDB.load("runbooks");
    let rows = await db.select<Snapshot[]>(
      "select * from snapshots where runbook_id = ? and tag = ?",
      [runbook_id, tag],
    );

    if (rows.length == 0) {
      return null;
    }

    let row = rows[0];
    return new Snapshot(row);
  }

  static async deleteForRunbook(runbook_id: string) {
    const db = await AtuinDB.load("runbooks");
    await db.execute("delete from snapshots where runbook_id = ?", [runbook_id]);
  }

  async delete() {
    const db = await AtuinDB.load("runbooks");
    await db.execute("delete from snapshots where id = ?", [this.id]);
  }
}
