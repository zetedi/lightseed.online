import React, { Component } from "react";
import withStyles from "@material-ui/core/styles/withStyles";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import PropTypes from "prop-types";
import MyButton from "../util/MyButton";
import AbsorbLight from "./AbsorbLight";
//Material UI
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardMedia from "@material-ui/core/CardMedia";
import Typography from "@material-ui/core/Typography";
// Icons
import ChatIcon from "@material-ui/icons/Chat";
import VisibilityIcon from "@material-ui/icons/Visibility";
import VisibilityOffIcon from "@material-ui/icons/VisibilityOff";

import { connect } from "react-redux";
import { seeLight, unseeLight } from "../redux/actions/dataActions";
import { yellow } from "@material-ui/core/colors";
// import { makeStyles } from "@material-ui/core/styles";

const styles = {
  card: {
    position: "relative",
    display: "flex",
    marginBottom: 20,
  },
  image: {
    minWidth: 150,
    margin: "14px auto 14px 14px",
    // minHeight: 100,
    backgroundColor: "#004900",
    borderRadius: "50%",
  },
  content: {
    padding: 25,
    // objectFit: "cover",
  },
  see: {
    color: "yellow",
  },
};

class Light extends Component {
  seenLight = () => {
    if (
      this.props.lightseed.sees &&
      this.props.lightseed.sees.find(
        (see) => see.lightId === this.props.light.lightId
      )
    )
      return true;
    else return false;
  };
  seeLight = () => {
    this.props.seeLight(this.props.light.lightId);
  };
  unseeLight = () => {
    this.props.unseeLight(this.props.light.lightId);
  };

  render() {
    dayjs.extend(relativeTime);
    const {
      classes,
      light: {
        body,
        createdAt,
        prism,
        lightseedHandle,
        lightId,
        seeCount,
        reflectCount,
      },
      lightseed: {
        authenticated,
        credentials: { handle },
      },
    } = this.props;
    const seeButton = !authenticated ? (
      <Link to="/login">
        <MyButton tip="See">
          <VisibilityOffIcon color="primary"></VisibilityOffIcon>
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
    const absorbButton =
      authenticated && lightseedHandle === handle ? (
        <AbsorbLight lightId={lightId} />
      ) : null;
    return (
      <Card className={classes.card}>
        <span className={classes.span}></span>
        <CardMedia
          image={prism}
          title="Prism"
          className={classes.image}
        ></CardMedia>
        <CardContent className={classes.content}>
          <Typography
            variant="h5"
            component={Link}
            color="primary"
            to={`/lightseeds/${lightseedHandle}/`}
          >
            {lightseedHandle}
          </Typography>
          {absorbButton}
          <Typography variant="body2" color="textSecondary">
            {dayjs(createdAt).fromNow()}
          </Typography>
          <Typography variant="body1">{body}</Typography>
          {seeButton}
          <span>seen by {seeCount}</span>
          <MyButton tip="reflects">
            <ChatIcon color="primary" />
          </MyButton>
          <span>{reflectCount} reflects</span>
        </CardContent>
      </Card>
    );
  }
}
Light.propTypes = {
  seeLight: PropTypes.func.isRequired,
  unseeLight: PropTypes.func.isRequired,
  // lightId: PropTypes.string.isRequired,
  lightseed: PropTypes.object.isRequired,
  light: PropTypes.object.isRequired,
  classes: PropTypes.object.isRequired,
  openDialog: PropTypes.bool,
};
const mapStateToProps = (state) => ({
  lightseed: state.lightseed,
});
const mapActionsToProps = {
  seeLight,
  unseeLight,
};
export default connect(
  mapStateToProps,
  mapActionsToProps
)(withStyles(styles)(Light));
