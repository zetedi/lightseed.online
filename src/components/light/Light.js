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
//Material UI
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardMedia from "@material-ui/core/CardMedia";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
// Icons
import ChatIcon from "@material-ui/icons/Chat";
import { connect } from "react-redux";

const styles = {
  card: {
    position: "relative",
    display: "flex",
    marginBottom: 20,
  },
  content: {
    padding: 25,
    objectFit: "cover",
    width: 700,
    marginRight: 49,
  },
  see: {
    color: "yellow",
  },
  prism: {
    maxWidth: 108,
    height: 108,
    borderRadius: "50%",
    objectFit: "cover",
    margin: "10px 10px 10px 10px",
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

    const absorbButton =
      authenticated && lightseedHandle === handle ? (
        <AbsorbLight lightId={lightId} />
      ) : null;
    return (
      <Card className={classes.card}>
        <Grid item sm={5}>
          <img src={prism} alt="Profile" className={classes.prism} />
        </Grid>
        <CardContent className={classes.content}>
          <Typography
            variant="h6"
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
          <Typography variant="body2">{body}</Typography>
          <SeeButton lightId={lightId} />
          <span>seen by {seeCount}</span>
          <MyButton tip="reflects">
            <ChatIcon color="primary" />
          </MyButton>
          <span>{reflectCount} reflects</span>
          <LightDialog lightId={lightId} lightseedHandle={lightseedHandle} />
        </CardContent>
      </Card>
    );
  }
}
Light.propTypes = {
  lightId: PropTypes.string.isRequired,
  lightseed: PropTypes.object.isRequired,
  light: PropTypes.object.isRequired,
  classes: PropTypes.object.isRequired,
  openDialog: PropTypes.bool,
};
const mapStateToProps = (state) => ({
  lightseed: state.lightseed,
});

export default connect(mapStateToProps)(withStyles(styles)(Light));
