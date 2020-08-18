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
    createdAt: new Date().toISOString(),
  };
  db.collection("lights")
    .add(newLight)
    .then((doc) => {
      res.json({ message: `document ${doc.id} created successfully` });
    })
    .catch((err) => {
      res.status(500).json({ error: "Something went wrong" });
      console.error(err);
    });
};
