import React, { Component } from "react";
import Grid from "@material-ui/core/Grid";
import PropTypes from "prop-types";

import Light from "../components/light/Light";
import Profile from "../components/profile/Profile";
import LightSkeleton from "../util/LightSkeleton";

import { connect } from "react-redux";
import { getLights } from "../redux/actions/dataActions";

class home extends Component {
  componentDidMount() {
    this.props.getLights();
  }
  render() {
    const { lights, loading } = this.props.data;
    let recentLightsMarkup = !loading ? (
      lights.map((light) => <Light key={light.lightId} light={light} />)
    ) : (
      <LightSkeleton />
    );
    return (
      <Grid container spacing={16}>
        <Grid item sm={8} xs={12}>
          {recentLightsMarkup}
        </Grid>
        <Grid item sm={4} xs={12}>
          <Profile />
        </Grid>
      </Grid>
    );
  }
}

home.propTypes = {
  getLights: PropTypes.func.isRequired,
  data: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => ({
  data: state.data,
});

export default connect(mapStateToProps, { getLights })(home);
