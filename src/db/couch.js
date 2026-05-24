import PouchDB from "pouchdb/dist/pouchdb";
import PouchDBFind from "pouchdb-find";

PouchDB.plugin(PouchDBFind);

let databases = {};
let initializedIndexes = new Set();

// async function ensureIndexes(db, userId) {
//   if (initializedIndexes.has(userId)) return;

//   initializedIndexes.add(userId);

//   try {
//     await db.createIndex({
//       index: {
//         fields: ["type"],
//         name: "idx_type",
//       },
//     });

//     await db.createIndex({
//       index: {
//         fields: ["type", "workspace_id"],
//         name: "idx_type_workspace",
//       },
//     });

//     await db.createIndex({
//       index: {
//         fields: ["type", "user_id"],
//         name: "idx_type_user",
//       },
//     });
//   } catch (err) {
//     console.warn("PouchDB index creation failed:", err);
//   }
// }

async function ensureIndexes(db, userId) {
  if (initializedIndexes.has(userId)) return;

  initializedIndexes.add(userId);

  try {
    await db.createIndex({
      index: { fields: ["type"] }
    });

    await db.createIndex({
      index: { fields: ["type", "workspace_id"] }
    });

    await db.createIndex({
      index: { fields: ["type", "user_id"] }
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
    // Stable per-user/device DB name. PouchDB persists this IndexedDB database
    // across reloads and app sessions until explicitly destroyed.
    databases[userId] = new PouchDB(`ts_local_${userId}`);
    ensureIndexes(databases[userId], userId);
  }

  return databases[userId];
}

export async function getDocsByType(db, type) {
  try {
    const result = await db.find({
      selector: { type },
      use_index: "idx_type",
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
    const result = await db.find({
      selector: {
        type: { $in: types },
      },
      use_index: "idx_type",
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

// Backward-compatible alias. This now only closes the in-memory handle and
// preserves the user's persistent IndexedDB cache. Use destroyLocalDB only for
// explicit account-data wipe flows.
export function resetLocalDB(userId) {
  return closeLocalDB(userId);
}
