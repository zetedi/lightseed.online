import React, { Component } from "react";
import withStyles from "@material-ui/core/styles/withStyles";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import PropTypes from "prop-types";
import MyButton from "../../util/MyButton";
import AbsorbLight from "./AbsorbLight";
import LightDialog from "./LightDialog";
import SeeButton from "./SeeButton";
// MUI Stuff
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardMedia from "@material-ui/core/CardMedia";
import Typography from "@material-ui/core/Typography";
// Icons
import ChatIcon from "@material-ui/icons/Chat";
// Redux
import { connect } from "react-redux";

const styles = {
  card: {
    position: "relative",
    display: "flex",
    marginBottom: 20,
  },
  image: {
    minWidth: 200,
  },
  content: {
    padding: 25,
    objectFit: "cover",
  },
};

class Light extends Component {
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

    const deleteButton =
      authenticated && lightseedHandle === handle ? (
        <AbsorbLight lightId={lightId} />
      ) : null;
    return (
      <Card className={classes.card}>
        <CardMedia
          image={prism}
          title="Profile image"
          className={classes.image}
        />
        <CardContent className={classes.content}>
          <Typography
            variant="h5"
            component={Link}
            to={`/lightseeds/${lightseedHandle}`}
            color="primary"
          >
            {lightseedHandle}
          </Typography>
          {deleteButton}
          <Typography variant="body2" color="textSecondary">
            {dayjs(createdAt).fromNow()}
          </Typography>
          <Typography variant="body1">{body}</Typography>
          <SeeButton lightId={lightId} />
          <span>{seeCount} Sees</span>
          <MyButton tip="reflects">
            <ChatIcon color="primary" />
          </MyButton>
          <span>{reflectCount} reflects</span>
          <LightDialog
            lightId={lightId}
            lightseedHandle={lightseedHandle}
            openDialog={this.props.openDialog}
          />
        </CardContent>
      </Card>
    );
  }
}

Light.propTypes = {
  lightseed: PropTypes.object.isRequired,
  light: PropTypes.object.isRequired,
  classes: PropTypes.object.isRequired,
  openDialog: PropTypes.bool,
};

const mapStateToProps = (state) => ({
  lightseed: state.lightseed,
});

export default connect(mapStateToProps)(withStyles(styles)(Light));
