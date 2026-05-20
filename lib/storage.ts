import { readFile } from "node:fs/promises";
import path from "node:path";
import { getMongoDatabase } from "@/lib/mongodb";
import type { AppDatabase } from "@/lib/types";

const dbPath = path.join(process.cwd(), "data", "app-db.json");
const collectionName = process.env.MONGODB_COLLECTION || "app_state";
const documentId = "primary";

const defaultDatabase: AppDatabase = {
  users: [],
  sessions: [],
  masterContacts: [],
  dueRecords: [],
  reminderRules: [],
  templates: [],
  dispatchSettings: [],
  reminderLogs: []
};

type StoredDatabaseDocument = AppDatabase & {
  _id: string;
  migratedFromFileAt?: string;
  updatedAt: string;
};

async function readLegacyFileDatabase() {
  try {
    const raw = await readFile(dbPath, "utf8");
    return JSON.parse(raw) as AppDatabase;
  } catch {
    return null;
  }
}

async function ensureDatabaseDocument() {
  const database = await getMongoDatabase();
  const collection = database.collection<StoredDatabaseDocument>(collectionName);
  const existing = await collection.findOne({ _id: documentId });

  if (existing) {
    return collection;
  }

  const legacyDatabase = await readLegacyFileDatabase();

  await collection.insertOne({
    _id: documentId,
    ...(legacyDatabase || defaultDatabase),
    migratedFromFileAt: legacyDatabase ? new Date().toISOString() : undefined,
    updatedAt: new Date().toISOString()
  });

  return collection;
}

export async function readDatabase() {
  const collection = await ensureDatabaseDocument();
  const document = await collection.findOne({ _id: documentId });

  if (!document) {
    throw new Error("MongoDB app state document was not found.");
  }

  const { _id, migratedFromFileAt, updatedAt, ...appDatabase } = document;
  return appDatabase satisfies AppDatabase;
}

export async function writeDatabase(database: AppDatabase) {
  const collection = await ensureDatabaseDocument();

  await collection.updateOne(
    { _id: documentId },
    {
      $set: {
        ...database,
        updatedAt: new Date().toISOString()
      }
    },
    { upsert: true }
  );
}

export async function updateDatabase<T>(updater: (database: AppDatabase) => T | Promise<T>) {
  const database = await readDatabase();
  const result = await updater(database);
  await writeDatabase(database);
  return result;
}
