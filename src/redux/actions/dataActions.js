import {
  SET_LIGHTS,
  LOADING_DATA,
  SEE_LIGHT,
  UNSEE_LIGHT,
  ABSORB_LIGHT,
  SET_ERRORS,
  EMIT_LIGHT,
  CLEAR_ERRORS,
  LOADING_UI,
  SET_LIGHT,
  STOP_LOADING_UI,
  REFLECT,
} from "../types";
import axios from "axios";

// Get all lights
export const getLights = () => (dispatch) => {
  dispatch({ type: LOADING_DATA });
  axios
    .get("/lights")
    .then((res) => {
      dispatch({
        type: SET_LIGHTS,
        payload: res.data,
      });
    })
    .catch((err) => {
      dispatch({
        type: SET_LIGHTS,
        payload: [],
      });
    });
};
export const getLight = (lightId) => (dispatch) => {
  dispatch({ type: LOADING_UI });
  axios
    .get(`/lights/${lightId}`)
    .then((res) => {
      dispatch({
        type: SET_LIGHT,
        payload: res.data,
      });
      dispatch({ type: STOP_LOADING_UI });
    })
    .catch((err) => console.log(err));
};
// Emit a light
export const emitLight = (newLight) => (dispatch) => {
  dispatch({ type: LOADING_UI });
  axios
    .post("/lights", newLight)
    .then((res) => {
      dispatch({
        type: EMIT_LIGHT,
        payload: res.data,
      });
      dispatch(clearErrors());
    })
    .catch((err) => {
      dispatch({
        type: SET_ERRORS,
        payload: err.response.data,
      });
    });
};
// See a light
export const seeLight = (lightId) => (dispatch) => {
  axios
    .get(`/lights/${lightId}/see`)
    .then((res) => {
      dispatch({
        type: SEE_LIGHT,
        payload: res.data,
      });
    })
    .catch((err) => console.log(err));
};
// Unsee a light
export const unseeLight = (lightId) => (dispatch) => {
  axios
    .get(`/lights/${lightId}/unsee`)
    .then((res) => {
      dispatch({
        type: UNSEE_LIGHT,
        payload: res.data,
      });
    })
    .catch((err) => console.log(err));
};
// Reflect
export const reflect = (lightId, reflectData) => (dispatch) => {
  axios
    .post(`/lights/${lightId}/reflect`, reflectData)
    .then((res) => {
      dispatch({
        type: REFLECT,
        payload: res.data,
      });
      dispatch(clearErrors());
    })
    .catch((err) => {
      dispatch({
        type: SET_ERRORS,
        payload: err.response.data,
      });
    });
};
export const deleteLight = (lightId) => (dispatch) => {
  axios
    .delete(`/lights/${lightId}`)
    .then(() => {
      dispatch({ type: ABSORB_LIGHT, payload: lightId });
    })
    .catch((err) => console.log(err));
};

export const getLightseedData = (lightseedHandle) => (dispatch) => {
  dispatch({ type: LOADING_DATA });
  axios
    .get(`/lightseed/${lightseedHandle}`)
    .then((res) => {
      dispatch({
        type: SET_LIGHTS,
        payload: res.data.lights,
      });
    })
    .catch(() => {
      dispatch({
        type: SET_LIGHTS,
        payload: null,
      });
    });
};

export const clearErrors = () => (dispatch) => {
  dispatch({ type: CLEAR_ERRORS });
};
