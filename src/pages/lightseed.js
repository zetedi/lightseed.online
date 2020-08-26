import React, { Component } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import Light from "../components/light/Light";
import StaticProfile from "../components/profile/StaticProfile";
import Grid from "@material-ui/core/Grid";

import LightSkeleton from "../util/LightSkeleton";
import ProfileSkeleton from "../util/ProfileSkeleton";

import { connect } from "react-redux";
import { getLightseedData } from "../redux/actions/dataActions";

class lightseed extends Component {
  state = {
    profile: null,
    lightIdParam: null,
  };
  componentDidMount() {
    const handle = this.props.match.params.handle;
    const lightId = this.props.match.params.lightId;

    if (lightId) this.setState({ lightIdParam: lightId });

    this.props.getLightseedData(handle);
    axios
      .get(`/lightseed/${handle}`)
      .then((res) => {
        this.setState({
          profile: res.data.lightseed,
        });
      })
      .catch((err) => console.log(err));
  }
  render() {
    const { lights, loading } = this.props.data;
    const { lightIdParam } = this.state;

    const lightsMarkup = loading ? (
      <LightSkeleton />
    ) : lights === null ? (
      <p>No lights from this lightseed</p>
    ) : !lightIdParam ? (
      lights.map((light) => <Light key={light.lightId} light={light} />)
    ) : (
      lights.map((light) => {
        if (light.lightId !== lightIdParam)
          return <Light key={light.lightId} light={light} />;
        else return <Light key={light.lightId} light={light} openDialog />;
      })
    );

    return (
      <Grid container spacing={16}>
        <Grid item sm={8} xs={12}>
          {lightsMarkup}
        </Grid>
        <Grid item sm={4} xs={12}>
          {this.state.profile === null ? (
            <ProfileSkeleton />
          ) : (
            <StaticProfile profile={this.state.profile} />
          )}
        </Grid>
      </Grid>
    );
  }
}

lightseed.propTypes = {
  getLightseedData: PropTypes.func.isRequired,
  data: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => ({
  data: state.data,
});

export default connect(mapStateToProps, { getLightseedData })(lightseed);
