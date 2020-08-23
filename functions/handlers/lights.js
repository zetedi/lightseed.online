const { db } = require("../util/admin");

exports.getAllLights = (req, res) => {
  db.collection("lights")
    .orderBy("createdAt", "desc")
    .get()
    .then((data) => {
      let lights = [];
      data.forEach((doc) => {
        lights.push({
          lightId: doc.id,
          body: doc.data().body,
          lightseedHandle: doc.data().lightseedHandle,
          createdAt: doc.data().createdAt,
          seeCount: doc.data().seeCount,
          reflectCount: doc.data().reflectCount,
        });
      });
      return res.json(lights);
    })
    .catch((err) => console.error(err));
};

exports.createLight = (req, res) => {
  const newLight = {
    body: req.body.body,
    lightseedHandle: req.user.handle,
    prism: req.user.prism,
    createdAt: new Date().toISOString(),
    seeCount: 0,
    reflectCount: 0,
  };
  db.collection("lights")
    .add(newLight)
    .then((doc) => {
      const resLight = newLight;
      resLight.lightId = doc.id;
      res.json({ resLight });
    })
    .catch((err) => {
      res.status(500).json({ error: "Something went wrong" });
      console.error(err);
    });
};

// Get one light
exports.getLight = (req, res) => {
  let lightData = {};
  db.doc(`/lights/${req.params.lightId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Light not found" });
      }
      lightData = doc.data();
      lightData.lightId = doc.id;
      return db
        .collection("reflects")
        .orderBy("createdAt", "desc")
        .where("lightId", "==", req.params.lightId)
        .get();
    })
    .then((data) => {
      lightData.reflects = [];
      data.forEach((doc) => {
        lightData.reflects.push(doc.data());
      });
      return res.json(lightData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// Reflect light
exports.reflectLight = (req, res) => {
  if (req.body.body.trim() === "")
    return res.status(400).json({ comment: "Must not be empty" });

  const newReflect = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    lightId: req.params.lightId,
    lightseedHandle: req.user.handle,
    prism: req.user.prism,
  };
  console.log(newReflect);

  db.doc(`/lights/${req.params.lightId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Light not found" });
      }
      return doc.ref.update({
        reflectCount: doc.data().reflectCount + 1,
      });
    })
    .then(() => {
      return db.collection("reflects").add(newReflect);
    })
    .then(() => {
      res.json(newReflect);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: "Something went wrong" });
    });
};

// See a light
exports.seeLight = (req, res) => {
  const seeDocument = db
    .collection("sees")
    .where("lightseedHandle", "==", req.user.handle)
    .where("lightId", "==", req.params.lightId)
    .limit(1);

  const lightDocument = db.doc(`/lights/${req.params.lightId}`);

  let lightData;

  lightDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        lightData = doc.data();
        lightData.lightId = doc.id;
        return seeDocument.get();
      } else {
        return res.status(404).json({ error: "Light not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return db
          .collection("sees")
          .add({
            lightId: req.params.lightId,
            lightseedHandle: req.user.handle,
          })
          .then(() => {
            lightData.seeCount++;
            return lightDocument.update({ seeCount: lightData.seeCount });
          })
          .then(() => {
            return res.json(lightData);
          });
      } else {
        return res.status(400).json({ error: "Light already seen!" });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.unseeLight = (req, res) => {
  const seeDocument = db
    .collection("sees")
    .where("lightseedHandle", "==", req.user.handle)
    .where("lightId", "==", req.params.lightId)
    .limit(1);

  const lightDocument = db.doc(`/lights/${req.params.lightId}`);

  let lightData;

  lightDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        lightData = doc.data();
        lightData.lightId = doc.id;
        return seeDocument.get();
      } else {
        return res.status(404).json({ error: "Light not found." });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ error: "Light not seen." });
      } else {
        return db
          .doc(`/sees/${data.docs[0].id}`)
          .delete()
          .then(() => {
            lightData.seeCount--;
            return lightDocument.update({ seeCount: lightData.seeCount });
          })
          .then(() => {
            res.json(lightData);
          });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// Absorb a light
exports.absorbLight = (req, res) => {
  const document = db.doc(`/lights/${req.params.lightId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Light not found" });
      }
      if (doc.data().lightseedHandle !== req.user.handle) {
        return res.status(403).json({ error: "Unauthorized" });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ message: "Light absorbed successfully" });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
