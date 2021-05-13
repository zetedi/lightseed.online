import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { makeStyles } from '@material-ui/core/styles';
import { Box, Button, Collapse, Divider, TextField } from '@material-ui/core';
import React, { useState, useRef } from 'react';
import Avatar from '@material-ui/core/Avatar';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import DeleteOutlineIcon from '@material-ui/icons/DeleteOutline';
import moment from 'moment';
import {
  SINGLE_PRESENT_QUERY,
  DELETE_PRESENT_MUTATION,
} from './PresentMutations';

const CREATE_COMMENT_MUTATION = gql`
  mutation CREATE_COMMENT_MUTATION($id: ID!, $body: String!) {
    createComment(presentId: $id, body: $body) {
      id
    }
  }
`;

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
}));

export default function CommentPresent(props) {
  const { addCommentExpanded, commentsExpanded, present, lifeseed } = props;
  const classes = useStyles();
  const [commentText, setCommentText] = useState('');
  const commentInputRef = useRef(null);

  const [deleteComment] = useMutation(DELETE_PRESENT_MUTATION, {
    refetchQueries: [
      {
        query: SINGLE_PRESENT_QUERY,
        variables: {
          id: present.id,
        },
      },
    ],
    awaitRefetchQueries: true,
  });

  const [createComment] = useMutation(CREATE_COMMENT_MUTATION, {
    variables: {
      id: present.id,
      body: commentText,
    },
    refetchQueries: [
      {
        query: SINGLE_PRESENT_QUERY,
        variables: {
          id: present.id,
        },
      },
    ],
    awaitRefetchQueries: true,
  });
  return (
    <>
      <Collapse in={addCommentExpanded} timeout="auto" unmountOnExit>
        <form>
          <Box style={{ margin: '.75rem', position: 'relative' }}>
            <TextField
              id="outlined-basic"
              label="Comment"
              variant="outlined"
              placeholder=""
              multiline
              rows={3}
              type="text"
              name="comment"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              ref={commentInputRef}
              style={{
                // position: 'absolute',
                // top: '1rem',
                marginBottom: '.875rem',
                width: '100%',
              }}
            />
            <Box display="flex" justifyContent="flex-end">
              <Button
                variant="contained"
                color="primary"
                disabled={commentText.trim() === ''}
                onClick={() => {
                  createComment().catch((err) => alert(err.message));
                  setCommentText('');
                }}
                style={{
                  height: '1.75rem',
                  marginBottom: '.15rem',
                  fontWeight: '200',
                }}
                size="small"
              >
                Comment
              </Button>
            </Box>
          </Box>
        </form>
      </Collapse>
      <Collapse in={commentsExpanded} timeout="auto" unmountOnExit>
        {/* <Divider style={{ margin: '.3rem .7rem' }} /> */}

        {present?.comments
          ?.slice()
          .reverse()
          .map((comment) => (
            <Box
              key={comment.id}
              style={{
                display: 'grid',
                justifyContent: 'space-between',
                gridTemplateColumns: '1fr 5fr 1fr',
                margin: '.3rem',
                marginLeft: '.3rem',
                marginRight: '.3rem',
                borderRadius: '4px',
                backgroundColor: '#fafafa',
              }}
            >
              <Avatar
                aria-label="recipe"
                className={classes.avatar}
                style={{ margin: '.3rem', transform: 'scale(0.8)' }}
              >
                <img
                  src={comment.lifeseed?.lifetree?.image}
                  style={{ height: '100%' }}
                />
              </Avatar>
              <Box
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'left',
                  margin: '.2rem',
                }}
              >
                <Typography variant="body2" paragraph>
                  {comment.body}
                </Typography>
                <Typography variant="h5">
                  {moment(comment.creationTime).fromNow()}
                </Typography>
              </Box>
              {lifeseed && lifeseed.id === comment?.lifeseed?.id && (
                <IconButton
                  size="small"
                  style={{ margin: 'auto', transform: 'scale(0.8)' }}
                  onClick={() => {
                    deleteComment({ variables: { id: comment.id } });
                  }}
                >
                  <DeleteOutlineIcon />
                </IconButton>
              )}
            </Box>
          ))}
      </Collapse>
    </>
  );
}
