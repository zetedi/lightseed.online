import React from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import "./App.css";
import createMuiTheme from "@material-ui/core/styles/createMuiTheme";
import createPalette from "@material-ui/core/styles/createPalette";
import { MuiThemeProvider } from "@material-ui/core/styles";
import themeData from "./util/theme";
import jwtDecode from "jwt-decode";

//REDUX
import { Provider } from "react-redux";
import store from "./redux/store";
import { SET_AUTHENTICATED } from "./redux/types";
import {
  logoutLightseed,
  getLightseedData,
} from "./redux/actions/lightseedActions";
//Axios
import axios from "axios";

//Pages
import home from "./pages/home";
import lightseed from "./pages/lightseed";
import login from "./pages/login";
import signup from "./pages/signup";

//Components
import Navbar from "./components/layout/Navbar";
import AuthRoute from "./util/AuthRoute";

const theme = createMuiTheme({
  ...themeData,
});

const token = localStorage.FBIdToken;
if (token) {
  const decodedToken = jwtDecode(token);
  if (decodedToken.exp * 1000 < Date.now()) {
    store.dispatch(logoutLightseed);
    window.location.href = "/login";
  } else {
    store.dispatch({ type: SET_AUTHENTICATED });
    axios.defaults.headers.common["Authorization"] = token;
    store.dispatch(getLightseedData());
  }
}

function App() {
  return (
    <MuiThemeProvider theme={theme}>
      <Provider store={store}>
        <Router>
          <Navbar />
          <div className="container">
            <Switch>
              <Route exact path="/" component={home} />
              <AuthRoute exact path="/login" component={login} />
              <AuthRoute exact path="/signup" component={signup} />
              <Route exact path="/lightseeds/:handle" component={lightseed} />
              <Route
                exact
                path="/lightseeds/:handle/light/:lightId"
                component={lightseed}
              />
            </Switch>
          </div>
        </Router>
      </Provider>
    </MuiThemeProvider>
  );
}

export default App;
