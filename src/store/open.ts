import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { locations } from "../locations";

export type Store = Database;

export function openStore(): Store {
  mkdirSync(dirname(locations.db), { recursive: true });
  const db = new Database(locations.db, { create: true });
  const schemaPath = fileURLToPath(new URL("./schema.sql", import.meta.url));
  db.exec(readFileSync(schemaPath, "utf8"));
  return db;
}
