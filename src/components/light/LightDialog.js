import React, { Component, Fragment } from "react";
import PropTypes from "prop-types";
import withStyles from "@material-ui/core/styles/withStyles";
import MyButton from "../../util/MyButton";
import dayjs from "dayjs";
import { Link } from "react-router-dom";
import SeeButton from "./SeeButton";
import Reflects from "./Reflects";
import ReflectForm from "./ReflectForm";
//MUI
import Dialog from "@material-ui/core/Dialog";
import DialogContent from "@material-ui/core/DialogContent";
import CircularProgress from "@material-ui/core/CircularProgress";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
//Icons
import CloseIcon from "@material-ui/icons/Close";
import UnfoldMore from "@material-ui/icons/UnfoldMore";
import ChatIcon from "@material-ui/icons/Chat";
//Redux
import { connect } from "react-redux";
import { getLight, clearErrors } from "../../redux/actions/dataActions";
// Styling
import themeData from "../../util/theme";

const styles = {
  ...themeData,
  prism: {
    maxWidth: 200,
    height: 200,
    borderRadius: "50%",
    objectFit: "cover",
  },
  dialogContent: {
    padding: 20,
  },
  closeButton: {
    position: "absolute",
    left: "90%",
  },
  expandButton: {
    position: "absolute",
    left: "90%",
  },
  spinnerDiv: {
    textAlign: "center",
    marginTop: 50,
    marginBottom: 50,
  },
};

class LightDialog extends Component {
  state = {
    open: false,
    oldPath: "",
    newPath: "",
  };
  componentDidMount() {
    if (this.props.openDialog) {
      this.handleOpen();
    }
  }
  handleOpen = () => {
    let oldPath = window.location.pathname;

    const { lightseedHandle, lightId } = this.props;
    const newPath = `/lightseeds/${lightseedHandle}/light/${lightId}`;

    if (oldPath === newPath) oldPath = `/lightseeds/${lightseedHandle}`;

    window.history.pushState(null, null, newPath);

    this.setState({ open: true, oldPath, newPath });
    this.props.getLight(this.props.lightId);
  };
  handleClose = () => {
    window.history.pushState(null, null, this.state.oldPath);
    this.setState({ open: false });
    this.props.clearErrors();
  };

  render() {
    const {
      classes,
      light: {
        body,
        createdAt,
        seeCount,
        lightId,
        reflectCount,
        prism,
        lightseedHandle,
        reflects,
      },
      UI: { loading },
    } = this.props;
    const dialogMarkup = loading ? (
      <div className={classes.spinnerDiv}>
        <CircularProgress size={200} thickness={2} />
      </div>
    ) : (
      <Grid container spacing={0}>
        <Grid item sm={5}>
          <img src={prism} alt="Profile" className={classes.prism} />
        </Grid>
        <Grid item sm={7}>
          <Typography
            component={Link}
            color="primary"
            variant="h5"
            to={`/lightseeds/${lightseedHandle}`}
          >
            &{lightseedHandle}
          </Typography>
          <hr className={classes.invisibleSeparator} />
          <Typography variant="body2" color="textSecondary">
            {dayjs(createdAt).format("h:mm a, MMMM DD YYYY")}
          </Typography>
          <hr className={classes.invisibleSeparator} />
          <Typography variant="body1">{body}</Typography>
          <SeeButton lightId={lightId} />
          <span>seen by {seeCount}</span>
          <MyButton tip="reflects">
            <ChatIcon color="primary" />
          </MyButton>
          <span>{reflectCount} reflects</span>
        </Grid>
        <hr className={classes.visibleSeparator} />
        <ReflectForm lightId={lightId} />
        <Reflects reflects={reflects} />
      </Grid>
    );
    return (
      <Fragment>
        <MyButton
          onClick={this.handleOpen}
          tip="Expand light"
          tipClassName={classes.expandButton}
        >
          {" "}
          <UnfoldMore color="primary" />
        </MyButton>
        <Dialog
          open={this.state.open}
          onClose={this.handleClose}
          fullWidth
          maxWidth="sm"
        >
          <MyButton
            tip="Close"
            onClick={this.handleClose}
            tipClassName={classes.closeButton}
          >
            <CloseIcon />
          </MyButton>
          <DialogContent className={classes.dialogContent}>
            {dialogMarkup}
          </DialogContent>
        </Dialog>
      </Fragment>
    );
  }
}

LightDialog.propTypes = {
  getLight: PropTypes.func.isRequired,
  clearErrors: PropTypes.func.isRequired,
  lightId: PropTypes.string.isRequired,
  lightseedHandle: PropTypes.string.isRequired,
  light: PropTypes.object.isRequired,
  UI: PropTypes.object.isRequired,
};

const mapStateToProps = (state) => ({
  light: state.data.light,
  UI: state.UI,
});

const mapActionToProps = {
  getLight,
  clearErrors,
};
export default connect(
  mapStateToProps,
  mapActionToProps
)(withStyles(styles)(LightDialog));
