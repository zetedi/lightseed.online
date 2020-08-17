const { db } = require("../util/admin");
const firebase = require("firebase");
const config = require("../util/config");
firebase.initializeApp(config);
const { validateSignUpData, validateLoginData } = require("../util/validators");
exports.login = (req, res) => {
  const lifeseed = {
    email: req.body.email,
    password: req.body.password,
  };

  const { valid, errors } = validateLoginData(lifeseed);
  if (!valid) return res.status(400).json(errors);

  firebase
    .auth()
    .signInWithEmailAndPassword(lifeseed.email, lifeseed.password)
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
  const newLifeseed = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    handle: req.body.handle,
  };

  const { valid, errors } = validateSignUpData(newLifeseed);
  if (!valid) return res.status(400).json(errors);

  let token, userId;

  db.doc(`/lifeseeds/${newLifeseed.handle}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return res.status(400).json({ handle: "this handle is already taken" });
      } else {
        return firebase
          .auth()
          .createUserWithEmailAndPassword(
            newLifeseed.email,
            newLifeseed.password
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
        handle: newLifeseed.handle,
        email: newLifeseed.email,
        createdAt: new Date().toISOString(),
        userId,
      };
      db.doc(`/lifeseeds/${newLifeseed.handle}`).set(userCredentials);
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
