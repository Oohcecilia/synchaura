import { getDB } from "@/db/couch";
import { nanoid } from "nanoid";
import { getDocument } from "./api";

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
  return (user?.access_rights || [])
    .map((a) => a.org_id)
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
