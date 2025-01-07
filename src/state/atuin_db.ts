import { dbPath } from "@/lib/utils";
import Database from "@tauri-apps/plugin-sql";

export type AtuinDatabase = "runbooks" | "kv";

function load(name: AtuinDatabase) {
  if (!name.endsWith(".db")) {
    name += ".db";
  }

  const path = `sqlite:${dbPath(name)}`;
  return Database.load(path);
}

const AtuinDB = {
  load,
};

export default AtuinDB;
