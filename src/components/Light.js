import React, { Component } from "react";
import withStyles from "@material-ui/core/styles/withStyles";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

//Material UI
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardMedia from "@material-ui/core/CardMedia";
import Typography from "@material-ui/core/Typography";
import { Grid } from "@material-ui/core";

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
    } = this.props;
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
          <Typography variant="body2" color="textSecondary">
            {dayjs(createdAt).fromNow()}
          </Typography>
          <Typography variant="body1">{body}</Typography>
        </CardContent>
      </Card>
    );
  }
}

export default withStyles(styles)(Light);
