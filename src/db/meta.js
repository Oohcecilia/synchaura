// db/meta.js

const USER_DOC_TYPES = new Set([
  "user",
  "membership",
  "workspace",
  "task",
  "team",
  "timelog",
  "notification",
]);

export async function hasUsableLocalData(db) {
  try {
    const result = await db.allDocs({ include_docs: true, limit: 25 });

    return result.rows.some((row) => {
      const doc = row.doc;
      return doc?.type && USER_DOC_TYPES.has(doc.type) && !doc._deleted;
    });
  } catch {
    return false;
  }
}

export async function isInitialized(db) {
  try {
    const meta = await db.get("app_meta");
    if (meta.initialized === true) return true;
  } catch {
    // Fall through to data-based detection.
  }

  return hasUsableLocalData(db);
}

export async function markInitialized(db) {
  try {
    const existing = await db.get("app_meta").catch(() => null);

    await db.put({
      ...(existing || {}),
      _id: "app_meta",
      initialized: true,
      initializedAt: Date.now(),
    });
  } catch (err) {
    if (err.status !== 409) throw err;
  }
}

export async function isDBInitialized(db, userId) {
  try {
    const meta = await db.get(`_local/app_meta_${userId}`);
    if (meta.initialized === true) return true;
  } catch {
    // Fall through to data-based detection.
  }

  return hasUsableLocalData(db);
}

export async function markDBInitialized(db, userId) {
  try {
    const id = `_local/app_meta_${userId}`;
    const existing = await db.get(id).catch(() => null);

    await db.put({
      ...(existing || {}),
      _id: id,
      initialized: true,
      initializedAt: Date.now(),
    });
  } catch (err) {
    if (err.status !== 409) {
      throw err;
    }
  }
}
