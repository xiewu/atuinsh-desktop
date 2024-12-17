import Database from "@tauri-apps/plugin-sql";
import { uuidv7 } from "uuidv7";

export default class Snapshot {
  id: string;
  tag: string;
  runbook_id: string;
  content: string;

  created: Date;

  constructor(
    id: string,
    tag: string,
    runbook_id: string,
    content: string,
    created: Date,
  ) {
    this.id = id;
    this.tag = tag;
    this.runbook_id = runbook_id;
    this.content = content;
    this.created = created;
  }

  static async create(
    tag: string,
    runbook_id: string,
    content: string,
  ): Promise<Snapshot> {
    let id = uuidv7();
    let snapshot = new Snapshot(id, tag, runbook_id, content, new Date());

    const db = await Database.load("sqlite:runbooks.db");
    await db.execute(
      "insert into snapshots (id, tag, runbook_id, content, created) VALUES (?, ?, ?, ?, ?)",
      [
        snapshot.id,
        snapshot.tag,
        snapshot.runbook_id,
        snapshot.content,
        snapshot.created,
      ],
    );

    return snapshot;
  }

  static async get(id: string): Promise<Snapshot | null> {
    const db = await Database.load("sqlite:runbooks.db");

    let row = await db.select<Snapshot[]>(
      "select * from snapshots where id = ?",
      [id],
    );

    if (row == null) {
      return null;
    }

    return new Snapshot(
      row[0].id,
      row[0].tag,
      row[0].runbook_id,
      row[0].content,
      row[0].created,
    );
  }

  static async findByRunbookId(runbook_id: string): Promise<Snapshot[]> {
    const db = await Database.load("sqlite:runbooks.db");
    let rows = await db.select<Snapshot[]>(
      "select * from snapshots where runbook_id = ? order by created desc, tag desc",
      [runbook_id],
    );

    return rows.map((row) => {
      let snap = new Snapshot(
        row.id,
        row.tag,
        row.runbook_id,
        row.content,
        row.created,
      );

      return snap;
    });
  }

  async delete() {
    const db = await Database.load("sqlite:runbooks.db");
    await db.execute("delete from snapshots where id = ?", [this.id]);
  }
}
