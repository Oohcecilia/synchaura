import PouchDB from "pouchdb/dist/pouchdb";
import PouchDBFind from "pouchdb-find";

PouchDB.plugin(PouchDBFind);

let databases = {};
let initializedIndexes = new Set();

async function ensureIndexes(db, userId) {
  if (initializedIndexes.has(userId)) return;

  initializedIndexes.add(userId);

  try {
    await db.createIndex({
      index: {
        fields: ["type"],
        name: "idx_type",
      },
    });

    await db.createIndex({
      index: {
        fields: ["type", "workspace_id"],
        name: "idx_type_workspace",
      },
    });

    await db.createIndex({
      index: {
        fields: ["type", "user_id"],
        name: "idx_type_user",
      },
    });
  } catch (err) {
    console.warn("Index creation failed:", err);
  }
}

export function getDB(userId) {
  if (!userId) {
    throw new Error("Function requires a valid userId.");
  }

  if (!databases[userId]) {
    databases[userId] = new PouchDB(`ts_local_${userId}`);
    if (typeof databases[userId].setMaxListeners === "function") {
      databases[userId].setMaxListeners(50);
    }
    databases[userId].__synchauraIndexReady = ensureIndexes(databases[userId], userId);
  }

  return databases[userId];
}

export async function getDocsByType(db, type) {
  try {
    await db.__synchauraIndexReady?.catch(() => {});

    const result = await db.find({
      selector: { type },
    });

    return result.docs || [];
  } catch (err) {
    console.warn(`Indexed query failed for type ${type}; falling back to allDocs`, err);

    const result = await db.allDocs({ include_docs: true });
    return result.rows
      .map((row) => row.doc)
      .filter((doc) => doc?.type === type);
  }
}

export async function getDocsByTypes(db, types = []) {
  if (!types.length) return [];

  try {
    await db.__synchauraIndexReady?.catch(() => {});

    const result = await db.find({
      selector: {
        type: { $in: types },
      },
    });

    return result.docs || [];
  } catch (err) {
    console.warn("Indexed multi-type query failed; falling back to allDocs", err);

    const typeSet = new Set(types);
    const result = await db.allDocs({ include_docs: true });
    return result.rows
      .map((row) => row.doc)
      .filter((doc) => doc?.type && typeSet.has(doc.type));
  }
}

export async function closeLocalDB(userId) {
  if (!userId || !databases[userId]) return;

  await databases[userId].close();
  delete databases[userId];
  initializedIndexes.delete(userId);
}

export async function destroyLocalDB(userId) {
  if (!userId) return;

  const db = getDB(userId);
  await db.destroy();
  delete databases[userId];
  initializedIndexes.delete(userId);
}

export function resetLocalDB(userId) {
  return closeLocalDB(userId);
}
