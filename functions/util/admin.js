const admin = require("firebase-admin");
var serviceAccount = require("../keys/admin.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://light-5197c.firebaseio.com",
});
const db = admin.firestore();
module.exports = { admin, db };
