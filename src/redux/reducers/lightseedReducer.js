import {
  SET_LIGHTSEED,
  SET_AUTHENTICATED,
  SET_UNAUTHENTICATED,
  LOADING_LIGHTSEED,
  SEE_LIGHT,
  UNSEE_LIGHT,
  MARK_MINDERS_READ,
} from "../types";

const initialState = {
  authenticated: false,
  loading: false,
  credentials: {},
  sees: [],
  reflects: [],
};

export default function (state = initialState, action) {
  switch (action.type) {
    case SET_AUTHENTICATED:
      return {
        ...state,
        authenticated: true,
      };
    case SET_UNAUTHENTICATED:
      return initialState;
    case SET_LIGHTSEED:
      return {
        authenticated: true,
        loading: false,
        ...action.payload,
      };
    case LOADING_LIGHTSEED:
      return {
        ...state,
        loading: true,
      };
    case SEE_LIGHT:
      return {
        ...state,
        sees: [
          ...state.sees,
          {
            lightseedHandle: state.credentials.handle,
            lightId: action.payload.lightId,
          },
        ],
      };
    case UNSEE_LIGHT:
      return {
        ...state,
        sees: state.sees.filter(
          (see) => see.lightId !== action.payload.lightId
        ),
      };
    case MARK_MINDERS_READ:
      state.reflects.forEach((not) => (not.read = true));
      return {
        ...state,
      };
    default:
      return state;
  }
}
