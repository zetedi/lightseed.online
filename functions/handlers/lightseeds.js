const { admin, db } = require("../util/admin");
const firebase = require("firebase");
const config = require("../util/config");
firebase.initializeApp(config);

const {
  validateSignUpData,
  validateLoginData,
  reduceLightseedDetails,
} = require("../util/validators");

exports.login = (req, res) => {
  const lightseed = {
    email: req.body.email,
    password: req.body.password,
  };

  const { valid, errors } = validateLoginData(lightseed);
  if (!valid) return res.status(400).json(errors);

  firebase
    .auth()
    .signInWithEmailAndPassword(lightseed.email, lightseed.password)
    .then((data) => {
      return data.user.getIdToken();
    })
    .then((token) => {
      return res.json({ token });
    })
    .catch((err) => {
      console.error(err);
      // auth/wrong-password (if(error.code === 'auth...)
      // auth/user-not-user
      return res
        .status(403)
        .json({ general: "Wrong credentials, please try again" });
    });
};

exports.signup = (req, res) => {
  const newLightseed = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle,
  };

  const { valid, errors } = validateSignUpData(newLightseed);
  if (!valid) return res.status(400).json(errors);

  const noImg = "no-img.png";

  let token, userId;

  db.doc(`/lightseeds/${newLightseed.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return res.status(400).json({ handle: "this handle is already taken" });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(
            newLightseed.email,
            newLightseed.password
          );
      }
    })
    .then((data) => {
      userId = data.user.uid;
      return data.user.getIdToken();
    })
    .then((idToken) => {
      token = idToken;
      const userCredentials = {
        handle: newLightseed.handle,
        email: newLightseed.email,
        createdAt: new Date().toISOString(),
        prism: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImg}?alt=media`,
        userId,
      };
      return db.doc(`/lightseeds/${newLightseed.handle}`).set(userCredentials);
      // return res.status(201).json({ token });
    })
    .then(() => {
      return res.status(201).json({ token });
    })
    .catch((err) => {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        return res.status(400).json({ email: "Email is already is use" });
      } else {
        return res
          .status(500)
          .json({ general: "Something went wrong, please try again" });
      }
    });
};

// Add lightseed details
exports.addLightseedDetails = (req, res) => {
  let lightseedDetails = reduceLightseedDetails(req.body);
  console.log(lightseedDetails);
  db.doc(`/lightseeds/${req.user.handle}`)
    .update(lightseedDetails)
    .then(() => {
      return res.json({ message: "Details added successfully" });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
// Get any lightseed's details
exports.getLightseedDetails = (req, res) => {
  let lightseedData = {};
  db.doc(`/lightseeds/${req.params.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        lightseedData.lightseed = doc.data();
        return db
          .collection("lights")
          .where("lightseedHandle", "==", req.params.handle)
          .orderBy("createdAt", "desc")
          .get();
      } else {
        return res.status(404).json({ errror: "Lightseed not found" });
      }
    })
    .then((data) => {
      lightseedData.lights = [];
      data.forEach((doc) => {
        lightseedData.lights.push({
          body: doc.data().body,
          createdAt: doc.data().createdAt,
          lightseedHandle: doc.data().lightseedHandle,
          prism: doc.data().prism,
          seeCount: doc.data().seeCount,
          reflectCount: doc.data().reflectCount,
          lightId: doc.id,
        });
      });
      return res.json(lightseedData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

// Get own lightseed details
exports.getAuthenticatedLightseed = (req, res) => {
  let lightseedData = {};
  db.doc(`/lightseeds/${req.user.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        lightseedData.credentials = doc.data();
        return db
          .collection("likes")
          .where("lightseedHandle", "==", req.user.handle)
          .get();
      }
    })
    .then((data) => {
      lightseedData.likes = [];
      data.forEach((doc) => {
        lightseedData.likes.push(doc.data());
      });
      return db
        .collection("minders")
        .where("recipient", "==", req.user.handle)
        .orderBy("createdAt", "desc")
        .limit(10)
        .get();
    })
    .then((data) => {
      lightseedData.minders = [];
      data.forEach((doc) => {
        lightseedData.minders.push({
          recipient: doc.data().recipient,
          sender: doc.data().sender,
          createdAt: doc.data().createdAt,
          lightId: doc.data().lightId,
          type: doc.data().type,
          read: doc.data().read,
          minderId: doc.id,
        });
      });
      return res.json(lightseedData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};

// Upload an image for lightseed - https://github.com/mscdex/busboy
exports.uploadImage = (req, res) => {
  const BusBoy = require("busboy");
  const path = require("path");
  const os = require("os");
  const fs = require("fs");

  const busboy = new BusBoy({ headers: req.headers });

  let imageToBeUploaded = {};
  let imageFileName;
  // String for image token
  //let generatedToken = uuid();

  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    // console.log(fieldname, file, filename, encoding, mimetype);
    if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
      return res.status(400).json({ error: "Wrong file type submitted!" });
    }
    // my.image.png => ['my', 'image', 'png']
    const imageExtension = filename.split(".")[filename.split(".").length - 1];
    // 32756238461724837.png
    // https://pixabay.com/vectors/blank-profile-picture-mystery-man-973460/
    imageFileName = `${Math.round(
      Math.random() * 1000000000000
    ).toString()}.${imageExtension}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
  });
  busboy.on("finish", () => {
    admin
      .storage()
      .bucket(config.storageBucket)
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype,
          },
        },
      })
      .then(() => {
        // Append token to url
        const prism = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media&token`;
        return db.doc(`/lightseeds/${req.user.handle}`).update({ prism });
      })
      .then(() => {
        return res.json({ message: "Image uploaded successfully" });
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).json({ error: "Something went wrong" });
      });
  });
  busboy.end(req.rawBody);
};

exports.markMindersRead = (req, res) => {
  let batch = db.batch();
  req.body.forEach((minderId) => {
    const minder = db.doc(`/minders/${minderId}`);
    batch.update(minder, { read: true });
  });
  batch
    .commit()
    .then(() => {
      return res.json({ message: "Minders marked read" });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
