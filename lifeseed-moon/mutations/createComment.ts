/* eslint-disable */
import { KeystoneContext, SessionStore } from "@keystone-next/types";
import { BasketItem } from "../schemas/BasketItem";
import { Session } from "../types";

import { CommentCreateInput } from "../.keystone/schema-types";

interface Arguments {
  presentId: string;
  body: string;
}

async function createComment(
  root: any,
  { presentId, body }: Arguments,
  context: KeystoneContext
): Promise<CommentCreateInput> {
  const sesh = context.session as Session;
  if (!sesh?.itemId) {
    throw new Error("You must be logged in to do this!");
  }
  const now = new Date().toISOString();
  return await context.lists.Comment.createOne({
    data: {
      body: body,
      creationTime: now,
      present: { connect: { id: presentId } },
      lifeseed: { connect: { id: sesh.itemId } },
    },
    resolveFields: false,
  });
}

export default createComment;
