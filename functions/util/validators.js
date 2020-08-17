const isEmail = (email) => {
  const regEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  if (email.match(regEx)) return true;
  else return false;
};
const isEmpty = (string) => {
  if (string.trim() === "") return true;
  else return false;
};

exports.validateSignUpData = (data) => {
  let errors = {};

  if (isEmpty(newLifeseed.email)) {
    errors.email = "Must not be empty";
  } else if (isEmail(newLifeseed.email)) {
    errors.email = "Must be a valid email address";
  }

  if (isEmpty(newLifeseed.password)) errors.password = "Must not be empty";

  if (newLifeseed.password !== newLifeseed.confirmPassword)
    errors.confirmPassword = "Passwords must match";

  if (isEmpty(newLifeseed.handle)) errors.handle = "Must not be empty";

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};

exports.validateLoginData = (data) => {
  let errors = {};

  if (isEmpty(lifeseed.email)) errors.email = "Must not be empty";
  if (isEmpty(lifeseed.password)) errors.password = "Must not be empty";

  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false,
  };
};
