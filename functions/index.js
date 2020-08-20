const functions = require("firebase-functions");
const app = require("express")();

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

exports.api = functions.region("europe-west3").https.onRequest(app);
// exports.api = functions.https.onRequest(app);
