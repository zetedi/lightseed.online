import React, { Component, Fragment } from "react";
import PropTypes from "prop-types";
import withStyles from "@material-ui/core/styles/withStyles";
import themeData from "../../util/theme";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
// MUI
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";

const styles = {
  ...themeData,
  reflectImage: {
    maxWidth: "100%",
    height: 100,
    objectFit: "cover",
    borderRadius: "50%",
  },
  reflectData: {
    marginLeft: 20,
  },
};

class Reflects extends Component {
  render() {
    const { reflects, classes } = this.props;
    return (
      <Grid container>
        {reflects.map((reflect, index) => {
          const { body, createdAt, prism, lightseedHandle } = reflect;
          return (
            <Fragment key={createdAt}>
              <Grid item sm={12}>
                <Grid container>
                  <Grid item sm={2}>
                    <img
                      src={prism}
                      alt="reflect"
                      className={classes.reflectImage}
                    />
                  </Grid>
                  <Grid item sm={9}>
                    <div className={classes.reflectData}>
                      <Typography
                        variant="h5"
                        component={Link}
                        to={`/lightseeds/${lightseedHandle}`}
                        color="primary"
                      >
                        {lightseedHandle}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {dayjs(createdAt).format("h:mm a, MMMM DD YYYY")}
                      </Typography>
                      <hr className={classes.invisibleSeparator} />
                      <Typography variabnt="body1">{body}</Typography>
                    </div>
                  </Grid>
                </Grid>
              </Grid>
              {index !== reflects.length - 1 && (
                <hr className={classes.visibleSeparator} />
              )}
            </Fragment>
          );
        })}
      </Grid>
    );
  }
}

Reflects.propTypes = {
  reflects: PropTypes.array.isRequired,
};

export default withStyles(styles)(Reflects);
