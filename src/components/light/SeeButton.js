import React, { Component } from "react";
import MyButton from "../../util/MyButton";
import { Link } from "react-router-dom";
import PropTypes from "prop-types";
// Icons
import FavoriteIcon from "@material-ui/icons/Favorite";
import FavoriteBorder from "@material-ui/icons/FavoriteBorder";
// REdux
import { connect } from "react-redux";
import { seeLight, unseeLight } from "../../redux/actions/dataActions";

export class SeeButton extends Component {
  seedLight = () => {
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
    const seeButton = !authenticated ? (
      <Link to="/login">
        <MyButton tip="See">
          <FavoriteBorder color="primary" />
        </MyButton>
      </Link>
    ) : this.seedLight() ? (
      <MyButton tip="Undo see" onClick={this.unseeLight}>
        <FavoriteIcon color="primary" />
      </MyButton>
    ) : (
      <MyButton tip="See" onClick={this.seeLight}>
        <FavoriteBorder color="primary" />
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

const mapStateToProps = (state) => ({
  lightseed: state.lightseed,
});

const mapActionsToProps = {
  seeLight,
  unseeLight,
};

export default connect(mapStateToProps, mapActionsToProps)(SeeButton);
