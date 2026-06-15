import { getDB } from "@/db/couch";
import { nanoid } from "nanoid";
import { getDocument } from "./api";

const getAccessWorkspaceId = (access) => access?.workspace_id || access?.org_id || null;

export async function getMembershipAccessForUser(userId) {
  if (!userId) return [];

  const db = getDB(userId);
  if (!db) return [];

  try {
    const result = await db.allDocs({ include_docs: true });
    return (result.rows || [])
      .map((row) => row.doc)
      .filter((doc) => doc?.type === "membership" && String(doc.user_id) === String(userId))
      .map((doc) => ({
        workspace_id: doc.workspace_id,
        role: doc.role || "member",
        team_ids: Array.isArray(doc.team_ids) ? doc.team_ids : [],
        _id: doc._id,
      }));
  } catch (err) {
    console.error("Error fetching membership access:", err);
    return [];
  }
}

export async function upsertMembershipAccess(userId, access) {
  if (!userId || !access) return null;

  const db = getDB(userId);
  if (!db) return null;

  const workspaceId = getAccessWorkspaceId(access);
  if (!workspaceId) return null;

  const role = access.role || "member";
  const teamIds = Array.isArray(access.team_ids)
    ? access.team_ids
    : Array.isArray(access.team_id)
      ? access.team_id
      : [];

  try {
    const result = await db.allDocs({ include_docs: true });
    const existing = (result.rows || [])
      .map((row) => row.doc)
      .find((doc) =>
        doc?.type === "membership" &&
        String(doc.user_id) === String(userId) &&
        String(doc.workspace_id) === String(workspaceId)
      );

    const now = new Date().toISOString();

    const nextDoc = existing
      ? {
          ...existing,
          role,
          team_ids: teamIds,
          updated_at: now,
          org_id: undefined,
          team_id: undefined,
        }
      : {
          _id: `mem_${nanoid()}`,
          type: "membership",
          user_id: userId,
          workspace_id: workspaceId,
          role,
          team_ids: teamIds,
          created_at: now,
          updated_at: now,
        };

    await db.put(nextDoc);
    return nextDoc;
  } catch (err) {
    console.error("Error upserting membership access:", err);
    throw err;
  }
}

// GENERIC CREATE
export async function createRecord(userId, storeName, data) {
  // 1. Get the DB instance for the user
  const db = getDB(userId);

  if (db) {
    // 2. Prepare the record
    const record = {
      _id: `${storeName}_${nanoid()}`, // Prefixing ID with storeName is a PouchDB best practice
      type: storeName,                 // Add a type field so you can filter/query later
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  
    try {
      // 3. PouchDB .put() only takes the document object
      await db.put(record);
      return record;
    } catch (err) {
      console.error(`Error creating record in ${storeName}:`, err);
      throw err;
    }
  }
  
  throw new Error("Database instance not found");
}

// GET BY MULTI-ORG (FAST)
export async function getByOrg(user, storeName, orgIds = []) {
  if (!orgIds.length) return [];

  const db = getDB(user?.id);

  if (!db) return [];

  try {
    // PouchDB find allows us to query all orgIds in one go
    const result = await db.find({
      selector: {
        type: { $eq: storeName },   // Filter by document type
        org_id: { $in: orgIds }     // Filter by any of the provided orgIds
      }
    });

    return result.docs; // PouchDB returns { docs: [...] }
  } catch (err) {
    console.error(`Error fetching ${storeName} by org:`, err);
    return [];
  }
}

export async function getUserOrgIds(user) {
  return (user?.access_rights || user?.memberships || [])
    .map((a) => a.org_id || a.workspace_id)
    .filter(Boolean);
}


export async function hasTaskAccess(user, task) {
  if (!user || !task) return false;

  const wsId = String(task.workspace_id);

  const membership = await getDocument("membership", wsId);

  const hasAccess =
    membership?.user_id === user?._id ||
    membership?.user_ids?.includes(user?._id);


  if (!hasAccess) return false;

  return true;
}
