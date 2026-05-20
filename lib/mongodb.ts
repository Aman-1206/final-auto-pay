import { MongoClient, type Db } from "mongodb";

declare global {
  var __mongoClientPromise__: Promise<MongoClient> | undefined;
}

function getClientPromise() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI. Add it to your .env.local file.");
  }

  if (process.env.NODE_ENV === "development") {
    if (!global.__mongoClientPromise__) {
      global.__mongoClientPromise__ = new MongoClient(mongoUri).connect();
    }

    return global.__mongoClientPromise__;
  }

  return new MongoClient(mongoUri).connect();
}

export async function getMongoDatabase(): Promise<Db> {
  const client = await getClientPromise();
  const mongoDatabaseName = process.env.MONGODB_DB || "auto-payment-reminder";
  return client.db(mongoDatabaseName);
}
