// import PouchDB from "pouchdb/dist/pouchdb.js"

// let db = null

// export function getDB(userId) {

//   // if (!userId) {
//   //   console.error("❌ user is not authenticated to access DB");
//   //   return;
//   // }

//   if (!db) {
//     db = new PouchDB(`teamstar_local_${userId}`);
//   }

//   return db;
// }

// export function resetLocalDB() {
//   db = null
// }



// db/couch.js

import PouchDB from "pouchdb/dist/pouchdb";

let databases = {};

export function getDB(userId) {

  if (!userId) {
    throw new Error(
      "Function requires a valid userId."
    );
  }

  if (!databases[userId]) {

    databases[userId] =
      new PouchDB(`ts_local_${userId}`);
  }

  return databases[userId];
}

export function resetLocalDB(userId) {

  if (!userId) return;

  if (databases[userId]) {

    databases[userId].close();

    delete databases[userId];
  }
}