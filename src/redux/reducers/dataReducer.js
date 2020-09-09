import {
  SET_LIGHTS,
  SEE_LIGHT,
  UNSEE_LIGHT,
  LOADING_DATA,
  ABSORB_LIGHT,
  EMIT_LIGHT,
  SET_LIGHT,
  REFLECT,
} from "../types";

const initialState = {
  lights: [],
  light: {},
  loading: false,
};

export default function (state = initialState, action) {
  switch (action.type) {
    case LOADING_DATA:
      return {
        ...state,
        loading: true,
      };
    case SET_LIGHTS:
      return {
        ...state,
        lights: action.payload,
        loading: false,
      };
    case SET_LIGHT:
      return {
        ...state,
        light: action.payload,
      };
    case SEE_LIGHT:
    case UNSEE_LIGHT:
      let index = state.lights.findIndex(
        (light) => light.lightId === action.payload.lightId
      );
      state.lights[index] = action.payload;
      if (state.light.lightId === action.payload.lightId) {
        state.light = action.payload;
      }
      return {
        ...state,
      };
    case ABSORB_LIGHT:
      let indexToSplice = state.lights.findIndex(
        (light) => light.lightId === action.payload
      );
      state.lights.splice(indexToSplice, 1);
      return {
        ...state,
      };
    case EMIT_LIGHT:
      return {
        ...state,
        lights: [action.payload, ...state.lights],
      };
    case REFLECT:
      return {
        ...state,
        light: {
          ...state.light,
          reflects: [action.payload, ...state.light.reflects],
        },
      };
    default:
      return state;
  }
}
