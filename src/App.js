import React, { Component } from "react";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import "./App.css";
// import MuiThemeProvider from "@material-ui/core/styles/MuiThemeProvider"; // { ThemeProvider as MuiThemeProvider }
import { ThemeProvider as MuiThemeProvider } from "@material-ui/core/styles";
import createMuiTheme from "@material-ui/core/styles/createMuiTheme";
import { makeStyles } from "@material-ui/core/styles";
import jwtDecode from "jwt-decode";
// Redux
import { Provider } from "react-redux";
import store from "./redux/store";
import { SET_AUTHENTICATED } from "./redux/types";
import {
  logoutLightseed,
  getLightseedData,
} from "./redux/actions/lightseedActions";
// Components
import Navbar from "./components/layout/Navbar";
import themeObject from "./util/theme";
import AuthRoute from "./util/AuthRoute";
// Pages
import home from "./pages/home";
import login from "./pages/login";
import signup from "./pages/signup";
import lightseed from "./pages/lightseed";

import axios from "axios";

const theme = createMuiTheme(themeObject);

axios.defaults.baseURL =
  "https://europe-west3-light-5197c.cloudfunctions.net/api";

const token = localStorage.FBIdToken;
if (token) {
  const decodedToken = jwtDecode(token);
  if (decodedToken.exp * 1000 < Date.now()) {
    store.dispatch(logoutLightseed());
    window.location.href = "/login";
  } else {
    store.dispatch({ type: SET_AUTHENTICATED });
    axios.defaults.headers.common["Authorization"] = token;
    store.dispatch(getLightseedData());
  }
}

class App extends Component {
  constructor() {
    super();
    this.state = {
      style: {},
      theme: createMuiTheme({
        palette: {
          primary: {
            light: "#33c9dc",
            main: "#00bcd4",
            dark: "#008394",
            contrastText: "#fff",
          },
          secondary: {
            light: "#ff6333",
            main: "#ff3d00",
            dark: "#b22a00",
            contrastText: "#fff",
          },
        },

        // the object to be spread
        spreadThis: {
          typography: {
            useNextVariants: true,
          },
          form: {
            textAlign: "center",
          },
          image: {
            margin: "10px auto 10px auto",
          },
          pageTitle: {
            margin: "10px auto 10px auto",
          },
          textField: {
            margin: "10px auto 10px auto",
          },
          button: {
            marginTop: 20,
            position: "relative",
          },
          customError: {
            color: "#ff0000",
            fontSize: "0.8rem",
            marginTop: 5,
          },
          progress: {
            position: "absolute",
          },
        },
      }),
    };

    console.log(" ### createMuiTheme(themeObject) - " + theme);
    console.log(theme);
    console.log(" ### this.state.theme - " + this.state.theme);
    console.log(this.state.theme);

    const style = (theme) => ({
      ...this.state.theme.spreadThis,
    });
    this.state.style = style;

    console.log(" ### this.state.style after spreadThis: " + style);
    console.log(this.state.style);
  }

  render() {
    return (
      <MuiThemeProvider theme={this.state.style}>
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
}

export default App;
