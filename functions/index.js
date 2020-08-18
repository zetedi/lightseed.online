const functions = require("firebase-functions");
const app = require("express")();

const FBAuth = require("./util/fbAuth");
const { getAllLights, createLight } = require("./handlers/lights");
const { login, signup, setPrism } = require("./handlers/lightseeds");

//Lights routes
app.get("/lights", getAllLights);
app.post("/light", FBAuth, createLight);

//Lightseeds routes
app.post("/signup", signup);
app.post("/login", login);
// app.post("/lightseed/setPrism", setPrism);

exports.api = functions.region("europe-west3").https.onRequest(app);
// exports.api = functions.https.onRequest(app);
