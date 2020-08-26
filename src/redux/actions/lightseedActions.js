import {
  SET_LIGHTSEED,
  SET_ERRORS,
  CLEAR_ERRORS,
  LOADING_UI,
  SET_UNAUTHENTICATED,
  LOADING_LIGHTSEED,
  MARK_REFLECTS_READ,
} from "../types";
import axios from "axios";

export const loginLightseed = (lightseedData, history) => (dispatch) => {
  dispatch({ type: LOADING_UI });
  axios
    .post("/login", lightseedData)
    .then((res) => {
      setAuthorizationHeader(res.data.token);
      dispatch(getLightseedData());
      dispatch({ type: CLEAR_ERRORS });
      history.push("/");
    })
    .catch((err) => {
      dispatch({
        type: SET_ERRORS,
        payload: err.response.data,
      });
    });
};

export const signupLightseed = (newLightseedData, history) => (dispatch) => {
  dispatch({ type: LOADING_UI });
  axios
    .post("/signup", newLightseedData)
    .then((res) => {
      setAuthorizationHeader(res.data.token);
      dispatch(getLightseedData());
      dispatch({ type: CLEAR_ERRORS });
      history.push("/");
    })
    .catch((err) => {
      dispatch({
        type: SET_ERRORS,
        payload: err.response.data,
      });
    });
};

export const logoutLightseed = () => (dispatch) => {
  localStorage.removeItem("FBIdToken");
  delete axios.defaults.headers.common["Authorization"];
  dispatch({ type: SET_UNAUTHENTICATED });
};

export const getLightseedData = () => (dispatch) => {
  dispatch({ type: LOADING_LIGHTSEED });
  axios
    .get("/lightseed")
    .then((res) => {
      dispatch({
        type: SET_LIGHTSEED,
        payload: res.data,
      });
    })
    .catch((err) => console.log(err));
};

export const uploadImage = (formData) => (dispatch) => {
  dispatch({ type: LOADING_LIGHTSEED });
  axios
    .post("/lightseed/image", formData)
    .then(() => {
      dispatch(getLightseedData());
    })
    .catch((err) => console.log(err));
};

export const editLightseedDetails = (lightseedDetails) => (dispatch) => {
  dispatch({ type: LOADING_LIGHTSEED });
  axios
    .post("/lightseed", lightseedDetails)
    .then(() => {
      dispatch(getLightseedData());
    })
    .catch((err) => console.log(err));
};

export const markReflectsRead = (reflectIds) => (dispatch) => {
  axios
    .post("/reflects", reflectIds)
    .then((res) => {
      dispatch({
        type: MARK_REFLECTS_READ,
      });
    })
    .catch((err) => console.log(err));
};

const setAuthorizationHeader = (token) => {
  const FBIdToken = `Bearer ${token}`;
  localStorage.setItem("FBIdToken", FBIdToken);
  axios.defaults.headers.common["Authorization"] = FBIdToken;
};
