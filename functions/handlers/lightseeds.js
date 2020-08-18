const { db } = require("../util/admin");
const firebase = require("firebase");
const config = require("../util/config");
firebase.initializeApp(config);
const { validateSignUpData, validateLoginData } = require("../util/validators");
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
        userId,
      };
      db.doc(`/lightseeds/${newLightseed.handle}`).set(userCredentials);
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

// // Upload a prism for lightseed
// exports.uploadImage = (req, res) => {
//   const BusBoy = require("busboy");
//   const path = require("path");
//   const os = require("os");
//   const fs = require("fs");

//   const busboy = new BusBoy({ headers: req.headers });

//   let imageToBeUploaded = {};
//   let imageFileName;
//   // String for image token
//   let generatedToken = uuid();

//   busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
//     console.log(fieldname, file, filename, encoding, mimetype);
//     if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
//       return res.status(400).json({ error: "Wrong file type submitted" });
//     }
//     // my.image.png => ['my', 'image', 'png']
//     const imageExtension = filename.split(".")[filename.split(".").length - 1];
//     // 32756238461724837.png
//     imageFileName = `${Math.round(
//       Math.random() * 1000000000000
//     ).toString()}.${imageExtension}`;
//     const filepath = path.join(os.tmpdir(), imageFileName);
//     imageToBeUploaded = { filepath, mimetype };
//     file.pipe(fs.createWriteStream(filepath));
//   });
//   busboy.on("finish", () => {
//     admin
//       .storage()
//       .bucket()
//       .upload(imageToBeUploaded.filepath, {
//         resumable: false,
//         metadata: {
//           metadata: {
//             contentType: imageToBeUploaded.mimetype,
//             //Generate token to be appended to imageUrl
//             firebaseStorageDownloadTokens: generatedToken,
//           },
//         },
//       })
//       .then(() => {
//         // Append token to url
//         const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media&token=${generatedToken}`;
//         return db.doc(`/users/${req.user.handle}`).update({ imageUrl });
//       })
//       .then(() => {
//         return res.json({ message: "image uploaded successfully" });
//       })
//       .catch((err) => {
//         console.error(err);
//         return res.status(500).json({ error: "something went wrong" });
//       });
//   });
//   busboy.end(req.rawBody);
// };
