import React, { Component, Fragment } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import PropTypes from "prop-types";
// MUI
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import Badge from "@material-ui/core/Badge";
// Icons
import NofificationsIcon from "@material-ui/icons/Notifications";
import VisibilityIcon from "@material-ui/icons/Visibility";
import ChatIcon from "@material-ui/icons/Chat";
// Redux
import { connect } from "react-redux";
import { markMindersRead } from "../../redux/actions/lightseedActions";

class Minders extends Component {
  state = {
    anchorEl: null,
  };
  handleOpen = (event) => {
    this.setState({ anchorEl: event.target });
  };
  handleClose = () => {
    this.setState({ anchorEl: null });
  };
  onMenuOpened = () => {
    let unreadMindersIds = this.props.minders
      .filter((minder) => !minder.read)
      .map((minder) => minder.minderId);
    this.props.markMindersRead(unreadMindersIds);
  };
  render() {
    const minders = this.props.minders;
    const anchorEl = this.state.anchorEl;

    dayjs.extend(relativeTime);

    let mindersIcon;
    if (minders && minders.length > 0) {
      minders.filter((minder) => minder.read === false).length > 0
        ? (mindersIcon = (
            <Badge
              badgeContent={
                minders.filter((minder) => minder.read === false).length
              }
              color="secondary"
            >
              <NofificationsIcon />
            </Badge>
          ))
        : (mindersIcon = <NofificationsIcon />);
    } else {
      mindersIcon = <NofificationsIcon />;
    }
    let mindersMarkup =
      minders && minders.length > 0 ? (
        minders.map((minder) => {
          const verb = minder.type === "see" ? "seen" : "reflected";
          const time = dayjs(minder.createdAt).fromNow();
          const iconColor = minder.read ? "primary" : "secondary";
          const icon =
            minder.type === "see" ? (
              <VisibilityIcon color={iconColor} style={{ marginRight: 10 }} />
            ) : (
              <ChatIcon color={iconColor} style={{ marginRight: 10 }} />
            );

          return (
            <MenuItem key={minder.createdAt} onClick={this.handleClose}>
              {icon}
              <Typography
                component={Link}
                color="default"
                variant="body1"
                to={`/lightseeds/${minder.recipient}/light/${minder.lightId}`}
              >
                {minder.sender} {verb} your light {time}
              </Typography>
            </MenuItem>
          );
        })
      ) : (
        <MenuItem onClick={this.handleClose}>You have no minders yet</MenuItem>
      );
    return (
      <Fragment>
        <Tooltip placement="top" title="Minders">
          <IconButton
            aria-owns={anchorEl ? "simple-menu" : undefined}
            aria-haspopup="true"
            onClick={this.handleOpen}
          >
            {mindersIcon}
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={this.handleClose}
          onEntered={this.onMenuOpened}
        >
          {mindersMarkup}
        </Menu>
      </Fragment>
    );
  }
}

Minders.propTypes = {
  markMindersRead: PropTypes.func.isRequired,
  minders: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => ({
  minders: state.lightseed.minders,
});

export default connect(mapStateToProps, { markMindersRead })(Minders);
