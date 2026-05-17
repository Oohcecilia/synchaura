// db/meta.js


export async function isInitialized(db) {
  try {
    const meta = await db.get("app_meta");
    return meta.initialized === true;
  } catch {
    return false;
  }
}

export async function markInitialized(db) {
  try {
    await db.put({
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
    const meta = await db.get(
      `_local/app_meta_${userId}`
    );

    const info = await db.info();

    return (
      meta.initialized === true &&
      info.doc_count > 0
    );
  } catch {
    return false;
  }
}

export async function markDBInitialized(
  db,
  userId
) {
  try {
    await db.put({
      _id: `_local/app_meta_${userId}`,
      initialized: true,
      initializedAt: Date.now(),
    });
  } catch (err) {
    // ignore if already exists
    if (err.status !== 409) {
      throw err;
    }
  }
}
