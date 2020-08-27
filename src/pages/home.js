import React, { Component } from "react";
import Grid from "@material-ui/core/Grid";
import axios from "axios";
import Light from "../components/Light";

export class home extends Component {
  state = {
    lights: null,
  };
  componentDidMount() {
    axios
      .get("/lights")
      .then((res) => {
        this.setState({
          lights: res.data,
        });
      })
      .catch((err) => console.log(err));
  }
  render() {
    let recentLightsMarkup = this.state.lights ? (
      this.state.lights.map((light) => (
        <Light key={light.lightId} light={light} />
      ))
    ) : (
      <p>Loading...</p>
    );
    return (
      <Grid container spacing={10}>
        <Grid item sm={8} xs={12}>
          {recentLightsMarkup}
        </Grid>
        <Grid item sm={4} xs={12}>
          <p>Profile...</p>
        </Grid>
      </Grid>
    );
  }
}

export default home;
