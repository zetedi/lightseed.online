import React, { Component } from "react";
import withStyles from "@material-ui/core/styles/withStyles";
import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import AppIcon from "../images/mala.jpg";
import axios from "axios";

// MUI
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import CircularProgress from "@material-ui/core/CircularProgress";
import { red } from "@material-ui/core/colors";

const styles = (theme) => ({
  form: {
    textAlign: "center",
  },
  image: {
    margin: "20px auto 20px auto",
    borderRadius: 7,
  },
  pageTitle: {
    margin: "10px auto 10px auto",
  },
  textField: {
    margin: "10px auto 10px auto",
  },
  button: {
    marginTop: 20,
    marginBottom: 20,
    position: "relative",
  },
  customError: {
    color: "red",
    fontSize: "0.8rem",
    marginTop: 10,
  },
  progress: {
    position: "absolute",
  },
});

class login extends Component {
  constructor() {
    super();
    this.state = {
      email: "",
      password: "",
      loading: false,
      errors: {},
    };
  }
  handleChange = (event) => {
    this.setState({
      [event.target.name]: event.target.value,
    });
  };

  //   componentWillReceiveProps(nextProps) {
  //     if (nextProps.UI.errors) {
  //       this.setState({ errors: nextProps.UI.errors });
  //     }
  //   }
  handleSubmit = (event) => {
    this.setState({
      loading: true,
    });
    event.preventDefault();
    const lightseedData = {
      email: this.state.email,
      password: this.state.password,
    };

    axios
      .post("/login", lightseedData)
      .then((res) => {
        console.log(res.data);
        localStorage.setItem("FBIdToken", `Bearer ${res.data.token}`);
        this.setState({
          loading: false,
        });
        this.props.history.push("/");
      })
      .catch((err) => {
        this.setState({
          errors: err.response.data,
          loading: false,
        });
      });
  };
  render() {
    const {
      classes,
      //   UI: { loading },
    } = this.props;
    const { errors, loading } = this.state;

    return (
      <Grid container className={classes.form}>
        <Grid item sm />
        <Grid item sm>
          <img src={AppIcon} alt="mala" className={classes.image} />
          <Typography variant="h4" className={classes.pageTitle}>
            Welcome!
          </Typography>
          <form noValidate onSubmit={this.handleSubmit}>
            <TextField
              id="email"
              name="email"
              type="email"
              label="Email"
              className={classes.textField}
              helperText={errors.email}
              error={errors.email ? true : false}
              value={this.state.email}
              onChange={this.handleChange}
              fullWidth
            />
            <TextField
              id="password"
              name="password"
              type="password"
              label="Password"
              className={classes.textField}
              helperText={errors.password}
              error={errors.password ? true : false}
              value={this.state.password}
              onChange={this.handleChange}
              fullWidth
            />
            {errors.general && (
              <Typography variant="body2" className={classes.customError}>
                {errors.general}
              </Typography>
            )}
            <Button
              type="submit"
              variant="contained"
              color="primary"
              className={classes.button}
              disabled={loading}
            >
              Login
              {loading && (
                <CircularProgress size={30} className={classes.progress} />
              )}
            </Button>
            <br />
            <small>
              If you have an invitation you can sign up{" "}
              <Link to="/signup">here</Link>
            </small>
          </form>
        </Grid>
        <Grid item sm />
      </Grid>
    );
  }
}

// const mapStateToProps = (state) => ({
//   user: state.user,
//   UI: state.UI,
// });

// const mapActionsToProps = {
//   loginUser,
// };

// export default connect(
//   mapStateToProps,
//   mapActionsToProps
// )(withStyles(styles)(login));

login.propTypes = {
  classes: PropTypes.object.isRequired,
  // loginUser: PropTypes.func.isRequired,
  // user: PropTypes.object.isRequired,
  // UI: PropTypes.object.isRequired
};

export default withStyles(styles)(login);
