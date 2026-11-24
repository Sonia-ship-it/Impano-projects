import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { Database } from "./types";

/**
 * Storage layer.
 *
 * - Default: a JSON file at DATA_DIR/db.json (DATA_DIR defaults to ./data).
 * - If KV_REST_API_URL + KV_REST_API_TOKEN (Upstash Redis / Vercel KV) are set, the
 *   whole database is stored under one key instead, so it works on serverless hosts.
 *
 * All writes go through `updateDB`, which serialises mutations inside this process.
 */

const KV_KEY = process.env.KV_DB_KEY || "impano_projects_db";

function kvConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

export function storageType(): "kv" | "file" {
  return kvConfig() ? "kv" : "file";
}

function dataFile() {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  return path.join(dir, "db.json");
}

function emptyDB(): Database {
  return {
    version: 1,
    meta: { sessionSecret: crypto.randomBytes(32).toString("hex"), projectSeq: {} },
    users: [],
    projects: [],
    activity: [],
  };
}

async function load(): Promise<Database | null> {
  const kv = kvConfig();
  if (kv) {
    const res = await fetch(`${kv.url}/get/${KV_KEY}`, {
      headers: { Authorization: `Bearer ${kv.token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`KV read failed (${res.status})`);
    const body = await res.json();
    if (!body?.result) return null;
    return typeof body.result === "string" ? JSON.parse(body.result) : body.result;
  }
  try {
    return JSON.parse(await fs.readFile(dataFile(), "utf8"));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function save(db: Database) {
  const json = JSON.stringify(db);
  const kv = kvConfig();
  if (kv) {
    const res = await fetch(`${kv.url}/set/${KV_KEY}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${kv.token}` },
      body: json,
    });
    if (!res.ok) throw new Error(`KV write failed (${res.status})`);
    return;
  }
  const file = dataFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  // Atomic write: write a temp file then rename over the original.
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, file);
}

let queue: Promise<unknown> = Promise.resolve();

export async function readDB(): Promise<Database> {
  // Wait for pending writes so reads see the latest state.
  await queue.catch(() => {});
  const db = await load();
  if (db) return db;
  // First run: create and persist an empty database (sets the session secret).
  return updateDB((d) => d);
}

/** Run a mutation against the database and persist it. Mutations are serialised. */
export function updateDB<T>(mutate: (db: Database) => T): Promise<T extends Promise<infer U> ? U : T> {
  const run = queue.then(async () => {
    const db = (await load()) ?? emptyDB();
    const result = await mutate(db);
    await save(db);
    return result;
  });
  queue = run.catch(() => {});
  return run as Promise<T extends Promise<infer U> ? U : T>;
}

export function newId(prefix = "") {
  return prefix + crypto.randomBytes(9).toString("base64url");
}
