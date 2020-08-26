import React, { Component, Fragment } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import PropTypes from "prop-types";
// MUI stuff
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import IconButton from "@material-ui/core/IconButton";
import Tooltip from "@material-ui/core/Tooltip";
import Typography from "@material-ui/core/Typography";
import Badge from "@material-ui/core/Badge";
// Icons
import CommentsIcon from "@material-ui/icons/Comment";
import FavoriteIcon from "@material-ui/icons/Favorite";
import ChatIcon from "@material-ui/icons/Chat";
// Redux
import { connect } from "react-redux";
import { markReflectsRead } from "../../redux/actions/lightseedActions";

class Reflects extends Component {
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
    let unreadReflectsIds = this.props.reflects
      .filter((not) => !not.read)
      .map((not) => not.reflectId);
    this.props.markReflectsRead(unreadReflectsIds);
  };
  render() {
    const reflects = this.props.reflects;
    const anchorEl = this.state.anchorEl;

    dayjs.extend(relativeTime);

    let reflectsIcon;
    if (reflects && reflects.length > 0) {
      reflects.filter((not) => not.read === false).length > 0
        ? (reflectsIcon = (
            <Badge
              badgeContent={reflects.filter((not) => not.read === false).length}
              color="secondary"
            >
              <CommentsIcon />
            </Badge>
          ))
        : (reflectsIcon = <CommentsIcon />);
    } else {
      reflectsIcon = <CommentsIcon />;
    }
    let reflectsMarkup =
      reflects && reflects.length > 0 ? (
        reflects.map((not) => {
          const verb = not.type === "see" ? "seen" : "commented on";
          const time = dayjs(not.createdAt).fromNow();
          const iconColor = not.read ? "primary" : "secondary";
          const icon =
            not.type === "see" ? (
              <FavoriteIcon color={iconColor} style={{ marginRight: 10 }} />
            ) : (
              <ChatIcon color={iconColor} style={{ marginRight: 10 }} />
            );

          return (
            <MenuItem key={not.createdAt} onClick={this.handleClose}>
              {icon}
              <Typography
                component={Link}
                color="default"
                variant="body1"
                to={`/lifeseeds/${not.recipient}/light/${not.lightId}`}
              >
                {not.sender} {verb} your light {time}
              </Typography>
            </MenuItem>
          );
        })
      ) : (
        <MenuItem onClick={this.handleClose}>You have no reflects yet</MenuItem>
      );
    return (
      <Fragment>
        <Tooltip placement="top" title="Reflects">
          <IconButton
            aria-owns={anchorEl ? "simple-menu" : undefined}
            aria-haspopup="true"
            onClick={this.handleOpen}
          >
            {reflectsIcon}
          </IconButton>
        </Tooltip>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={this.handleClose}
          onEntered={this.onMenuOpened}
        >
          {reflectsMarkup}
        </Menu>
      </Fragment>
    );
  }
}

Reflects.propTypes = {
  markReflectsRead: PropTypes.func.isRequired,
  reflects: PropTypes.array.isRequired,
};

const mapStateToProps = (state) => ({
  reflects: state.lightseed.reflects,
});

export default connect(mapStateToProps, { markReflectsRead })(Reflects);
