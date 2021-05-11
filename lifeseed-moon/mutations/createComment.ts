/* eslint-disable */
import { KeystoneContext, SessionStore } from '@keystone-next/types';
import { BasketItem } from '../schemas/BasketItem';
import { Session } from '../types';

import { CommentCreateInput } from '../.keystone/schema-types';

interface Arguments {
    body: string;
  }

async function createComment(
  root: any,
  { presentId }: { presentId: string },
  context: KeystoneContext,
  // { body }: {body: string},
): Promise<CommentCreateInput> {
  // 1. Query the current lifeseed see if they are signed in
  const sesh = context.session as Session;
  if (!sesh?.itemId) {
    throw new Error('You must be logged in to do this!');
  }
  console.log('Logged in id:' +sesh?.itemId);
  const now = new Date().toISOString();
  return await context.lists.Comment.createOne({
    data: {
      body: "",
      creationTime: now,
      present: { connect: { id: presentId }},
      lifeseed: { connect: { id: sesh.itemId }},
    },
    resolveFields: false,
  })
}

export default createComment;