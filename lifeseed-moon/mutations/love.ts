/* eslint-disable */
import { KeystoneContext, SessionStore } from "@keystone-next/types";
import { BasketItem } from "../schemas/BasketItem";
import { Session } from "../types";

import { PresentCreateInput } from "../.keystone/schema-types";

interface Arguments {
  presentId: string;
}

async function love(
  root: any,
  { presentId }: Arguments,
  context: KeystoneContext
): Promise<PresentCreateInput> {
  const sesh = context.session as Session;
  if (!sesh?.itemId) {
    throw new Error("Who would like to do this?");
  }
  const love = await context.lists.Love.findMany({
    where: { lifeseed: { id: sesh.itemId }, present: { id: presentId } },
    resolveFields: "id",
  });
  if (love[0]) {
    await context.lists.Love.deleteOne({
      id: love[0].id,
    });
  } else {
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
}

export default love;
