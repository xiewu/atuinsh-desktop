/// A persistent disk store for storing state
/// The main store is persisted, but only to localstorage. It could
/// be cleared. It is also reactive, and handles subscriptions.
/// It can be rebuilt fairly easily and quickly, and only stores a cache.
///
/// On the other hand, the DiskStore uses SQLite, and cannot be easily cleared.
/// The idea here is to be a super-simple store for longer-term state.
import Database from "@tauri-apps/plugin-sql";

export class KVStore {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  static async open_default(): Promise<KVStore> {
    const db = await Database.load("sqlite:kv.db");

    db.execute("create table if not exists kv(key text primary key, value text)");

    return new KVStore(db);
  }

  // Get a value from the store, and decode the json
  async get<T = string>(key: string): Promise<T | null> {
    let res = await this.db.select<any[]>("select value from kv where key = $1", [key]);

    if (res.length == 0) {
      return null;
    }

    return JSON.parse(res[0].value);
  }

  // Set a value in the store, encoded as JSON
  async set<T = string>(key: string, value: T): Promise<void> {
    await this.db.execute("insert or replace into kv(key, value) values($1, $2)", [
      key,
      JSON.stringify(value),
    ]);
  }

  // Delete a key from the store
  async delete(key: string): Promise<void> {
    await this.db.execute("delete from kv where key = $1", [key]);
  }
}
