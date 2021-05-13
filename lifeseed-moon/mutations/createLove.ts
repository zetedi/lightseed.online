/* eslint-disable */
import { KeystoneContext, SessionStore } from "@keystone-next/types";
import { BasketItem } from "../schemas/BasketItem";
import { Session } from "../types";

import { CommentCreateInput } from "../.keystone/schema-types";

interface Arguments {
  presentId: string;
}

async function createLove(
  root: any,
  { presentId }: Arguments,
  context: KeystoneContext
): Promise<CommentCreateInput> {
    console.log("LOVE! LOVE! LOVE! LOVE! LOVE! LOVE! LOVE! LOVE! LOVE! LOVE! LOVE! LOVE! LOVE! LOVE! LOVE! LOVE! ")
  const sesh = context.session as Session;
  if (!sesh?.itemId) {
    throw new Error("Who would like to do this?");
  }
  const now = new Date().toISOString();
  return await context.lists.Love.createOne({
    data: {
      creationTime: now,
      present: { connect: { id: presentId } },
      lifeseed: { connect: { id: sesh.itemId } },
    },
    resolveFields: false,
  });
}

export default createLove;
