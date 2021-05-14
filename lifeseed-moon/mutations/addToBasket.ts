/* eslint-disable */
import { KeystoneContext, SessionStore } from '@keystone-next/types';
import { BasketItem } from '../schemas/BasketItem';
import { Session } from '../types';

import { BasketItemCreateInput } from '../.keystone/schema-types';

async function addToBasket(
  root: any,
  { presentId }: { presentId: string },
  context: KeystoneContext
): Promise<BasketItemCreateInput> {
  // console.log('ADDING TO BASKET!');
  // 1. Query the current lifeseed see if they are signed in
  const sesh = context.session as Session;
  if (!sesh.itemId) {
    throw new Error('You must be logged in to do this!');
  }
  // 2. Query the current lifeseeds basket
  const allBasketItems = await context.lists.BasketItem.findMany({
    where: { lifeseed: { id: sesh.itemId }, present: { id: presentId } },
    resolveFields: 'id,quantity'
  });

  const [existingBasketItem] = allBasketItems;
  if (existingBasketItem) {
    // console.log(existingBasketItem)
    // console.log(
    //   `There are already ${existingBasketItem.quantity}, increment by 1!`
    // );
    // 3. See if the current item is in their basket
    // 4. if itis, increment by 1
    return await context.lists.BasketItem.updateOne({
      id: existingBasketItem.id,
      data: { quantity: existingBasketItem.quantity + 1 },
      resolveFields: false,
    });
  }
  // 4. if it isnt, create a new basket item!
  return await context.lists.BasketItem.createOne({
    data: {
      present: { connect: { id: presentId }},
      lifeseed: { connect: { id: sesh.itemId }},
    },
    resolveFields: false,
  })
}

export default addToBasket;