import React, { Component } from "react";
import withStyles from "@material-ui/core/styles/withStyles";
import MyButton from "../../util/MyButton";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
// Icons
import VisibilityIcon from "@material-ui/icons/Visibility";
// redux
import { connect } from "react-redux";
import { seeLight, unseeLight } from "../../redux/actions/dataActions";

const styles = {
  see: {
    color: "yellow",
  },
};

export class SeeButton extends Component {
  seenLight = () => {
    if (
      this.props.lightseed.sees &&
      this.props.lightseed.sees.find(
        (see) => see.lightId === this.props.lightId
      )
    )
      return true;
    else return false;
  };
  seeLight = () => {
    this.props.seeLight(this.props.lightId);
  };
  unseeLight = () => {
    this.props.unseeLight(this.props.lightId);
  };

  render() {
    const { authenticated } = this.props.lightseed;
    const { classes } = this.props;
    const seeButton = !authenticated ? (
      <Link to="/login">
        <MyButton tip="See">
          <VisibilityIcon color="primary"></VisibilityIcon>
        </MyButton>
      </Link>
    ) : this.seenLight() ? (
      <MyButton tip="Unsee" onClick={this.unseeLight}>
        <VisibilityIcon
          color="secondary"
          className={classes.see}
        ></VisibilityIcon>
      </MyButton>
    ) : (
      <MyButton tip="See" onClick={this.seeLight}>
        <VisibilityIcon color="primary"></VisibilityIcon>
      </MyButton>
    );
    return seeButton;
  }
}

SeeButton.propTypes = {
  lightseed: PropTypes.object.isRequired,
  lightId: PropTypes.string.isRequired,
  seeLight: PropTypes.func.isRequired,
  unseeLight: PropTypes.func.isRequired,
};

const mapStateToProps = (state) => ({ lightseed: state.lightseed });

const mapActionsToProps = {
  seeLight,
  unseeLight,
};
export default connect(
  mapStateToProps,
  mapActionsToProps
)(withStyles(styles)(SeeButton));
