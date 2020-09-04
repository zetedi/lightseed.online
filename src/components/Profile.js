import React, { Component, Fragment } from "react";
import PropTypes from "prop-types";
import withStyles from "@material-ui/core/styles/withStyles";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import MyButton from "../util/MyButton";
import EditDetails from "./EditDetails";
// MUI stuff
import Button from "@material-ui/core/Button";
import Typography from "@material-ui/core/Typography";
import MuiLink from "@material-ui/core/Link";
import Paper from "@material-ui/core/Paper";
// Icons
import LocationOn from "@material-ui/icons/LocationOn";
import LinkIcon from "@material-ui/icons/Link";
import CalendarToday from "@material-ui/icons/CalendarToday";
import EditIcon from "@material-ui/icons/Edit";
import IconButton from "@material-ui/core/IconButton";
import ExitToApp from "@material-ui/icons/ExitToApp";
//Redux
import { connect } from "react-redux";
import {
  logoutLightseed,
  uploadImage,
} from "../redux/actions/lightseedActions";
// Styling
import themeData from "../util/theme";
import { Tooltip } from "@material-ui/core";
const styles = {
  ...themeData,
};

class Profile extends Component {
  handleImageChange = (event) => {
    const image = event.target.files[0];
    const formData = new FormData();
    formData.append("image", image, image.name);
    console.log(" - handleImageChange ");
    console.log(formData);
    this.props.uploadImage(formData);
  };
  handleEditPicture = () => {
    const fileInput = document.getElementById("imageInput");
    fileInput.click();
  };
  handleLogout = () => {
    this.props.logoutLightseed();
  };
  render() {
    const {
      classes,
      lightseed: {
        credentials: { handle, createdAt, prism, bio, link, location },
        loading,
        authenticated,
      },
    } = this.props;

    let profileMarkup = !loading ? (
      authenticated ? (
        <Paper className={classes.paper}>
          <div className={classes.profile}>
            <div className="image-wrapper">
              <img src={prism} alt="profile" className="profile-image" />
              <input
                type="file"
                id="imageInput"
                hidden="hidden"
                onChange={this.handleImageChange}
              />
              <MyButton
                tip="Edit profile picture"
                onClick={this.handleEditPicture}
                btnClassName="button"
              >
                <EditIcon color="secondary" />
              </MyButton>
            </div>
            <hr />
            <div className="profile-details">
              <MuiLink
                component={Link}
                to={`/lightseed/${handle}`}
                variant="h5"
              >
                <Typography color="secondary" variant="h5">
                  @{handle}
                </Typography>
              </MuiLink>
              <hr />
              {bio && <Typography variant="body2">{bio}</Typography>}
              <hr />
              {location && (
                <Fragment>
                  <LocationOn color="primary" /> <span>{location}</span>
                  <hr />
                </Fragment>
              )}
              {link && (
                <Fragment>
                  <LinkIcon color="primary" />
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    {" "}
                    {link}
                  </a>
                  <hr />
                </Fragment>
              )}
              <CalendarToday color="primary" />{" "}
              <span>Joined {dayjs(createdAt).format("MMM YYYY")}</span>
            </div>
            <Tooltip title="logout">
              <MyButton tip="Logout" onClick={this.handleLogout}>
                <ExitToApp color="primary"></ExitToApp>
              </MyButton>
            </Tooltip>
            <EditDetails />
          </div>
        </Paper>
      ) : (
        <Paper className={classes.paper}>
          <div className={classes.buttons}>
            <Button
              variant="contained"
              color="primary"
              component={Link}
              to="/login"
            >
              Login
            </Button>
            <Button
              variant="contained"
              color="secondary"
              component={Link}
              to="/signup"
            >
              Signup
            </Button>
          </div>
        </Paper>
      )
    ) : (
      <p>Loading...</p>
    );
    return profileMarkup;
  }
}
const mapStateToProps = (state) => ({
  lightseed: state.lightseed,
});

const mapActionsToProps = { logoutLightseed, uploadImage };

Profile.propTypes = {
  logoutLightseed: PropTypes.func.isRequired,
  uploadImage: PropTypes.func.isRequired,
  lightseed: PropTypes.object.isRequired,
  classes: PropTypes.object.isRequired,
};

export default connect(
  mapStateToProps,
  mapActionsToProps
)(withStyles(styles)(Profile));
