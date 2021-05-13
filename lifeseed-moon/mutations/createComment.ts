/* eslint-disable */
import { KeystoneContext, SessionStore } from "@keystone-next/types";
import { Session } from "../types";
import { PresentCreateInput } from "../.keystone/schema-types";
interface Arguments {
  presentId: string;
  body: string;
}

async function createComment(
  root: any,
  { presentId, body }: Arguments,
  context: KeystoneContext
): Promise<PresentCreateInput> {
  const sesh = context.session as Session;
  if (!sesh?.itemId) {
    throw new Error("Who would like to do this?");
  }
  const now = new Date().toISOString();
  return await context.lists.Present.createOne({
    data: {
      body: body,
      creationTime: now,
      comment: { connect: { id: presentId } },
      lifeseed: { connect: { id: sesh.itemId } },
      type: 'COMMENT',
      status: 'AVAILABLE'
    },
    resolveFields: false,
  });
}

export default createComment;
