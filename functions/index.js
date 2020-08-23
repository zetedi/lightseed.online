const functions = require("firebase-functions");
const app = require("express")();
const { db } = require("./util/admin");

const FBAuth = require("./util/fbAuth");
const {
  getAllLights,
  createLight,
  getLight,
  reflectLight,
  seeLight,
  unseeLight,
  absorbLight,
} = require("./handlers/lights");
const {
  login,
  signup,
  uploadImage,
  addLightseedDetails,
  getAuthenticatedLightseed,
  markMindersRead,
  getLightseedDetails,
} = require("./handlers/lightseeds");

//Lights routes
app.post("/light", FBAuth, createLight);
app.get("/lights", getAllLights);
app.get("/lights/:lightId", getLight);
app.delete("/lights/:lightId", FBAuth, absorbLight);
app.get("/lights/:lightId/see", FBAuth, seeLight);
app.get("/lights/:lightId/unsee", FBAuth, unseeLight);
app.post("/lights/:lightId/reflect", FBAuth, reflectLight);

//Lightseeds routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/lightseed/uploadImage", FBAuth, uploadImage);
app.post("/lightseed", FBAuth, addLightseedDetails);
app.get(
  "/lightseed/getAuthenticatedLightseed",
  FBAuth,
  getAuthenticatedLightseed
);
app.get("/lightseed/:handle", getLightseedDetails);
app.post("/minders", FBAuth, markMindersRead);

exports.api = functions.region("europe-west3").https.onRequest(app);

// exports.api = functions.https.onRequest(app);

// exports.createMinderOnSee = functions
//   .region("europe-west3")
//   .firestore.document("sees/{id}")
//   .onCreate((snapshot) => {
//     return db
//       .doc(`/lights/${snapshot.data().lightId}`)
//       .get()
//       .then((doc) => {
//         if (
//           doc.exists &&
//           doc.data().lightseedHandle !== snapshot.data().lightseedHandle
//         ) {
//           return db.doc(`/minders/${snapshot.id}`).set({
//             createdAt: new Date().toISOString(),
//             recipient: doc.data().lightseedHandle,
//             sender: snapshot.data().lightseedHandle,
//             type: "see",
//             read: false,
//             lightId: doc.id,
//           });
//         }
//       })
//       .catch((err) => console.error(err));
//   });

exports.createMinderOnReflect = functions
  .region("europe-west3")
  .firestore.document("reflects/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/lights/${snapshot.data().lightId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().lightseedHandle !== snapshot.data().lightseedHandle
        ) {
          return db.doc(`/minders/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().lightseedHandle,
            sender: snapshot.data().lightseedHandle,
            type: "reflect",
            read: false,
            lightId: doc.id,
          });
        }
      })
      .catch((err) => {
        console.error(err);
      });
  });

exports.onPrismChange = functions
  .region("europe-west3")
  .firestore.document("lightseeds/{lightseedId}")
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().prism !== change.after.data().prism) {
      console.log("Prism has changed");
      const batch = db.batch();
      return db
        .collection("lights")
        .where("lightseedHandle", "==", change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const light = db.doc(`/lights/${doc.id}`);
            batch.update(light, { prism: change.after.data().prism });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onLightAbsorb = functions
  .region("europe-west3")
  .firestore.document("lights/{lightId}")
  .onDelete((snapshot, context) => {
    const lightId = context.params.lightId;
    const batch = db.batch();
    return db
      .collection("reflects")
      .where("lightId", "==", lightId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/reflects/${doc.id}`));
        });
        return db.collection("sees").where("lightId", "==", lightId).get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/sees/${doc.id}`));
        });
        return db.collection("reflects").where("lightId", "==", lightId).get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/reflects/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });
