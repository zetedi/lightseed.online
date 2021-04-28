/* eslint-disable */
import { KeystoneContext, SessionStore } from "@keystone-next/types";
import { BasketItem } from "../schemas/BasketItem";
import { Session } from "../types";

import {
  BasketItemCreateInput,
  PackageCreateInput,
} from "../.keystone/schema-types";
import stripeConfig from "../lib/stripe";

const graphql = String.raw;

interface Arguments {
  token: string;
}

async function checkout(
  root: any,
  { token }: Arguments,
  context: KeystoneContext
): Promise<PackageCreateInput> {
  const userId = context.session.itemId;
  if (!userId) {
    throw new Error("Sorry, you must be signed in to create a package.");
  }

  const user = await context.lists.User.findOne({
    where: { id: userId },
    resolveFields: graphql`
      id
      name
      email
      basket {
        id
        quantity
        present {
          name
          price
          body
          id
          photo {
            id
            image {
              id
              publicUrlTransformed
            }
          }
        }
      }
    `,
  });
  console.log(user);
  console.dir(user, { depth: null });
  const basketItems = user.basket.filter((basketItem) => basketItem.present);
  const amount = basketItems.reduce(function (
    tally: number,
    basketItem: BasketItemCreateInput
  ) {
    return (tally + basketItem.quantity * basketItem.present.price);
  },
  0);
  console.log(amount);
  const charge = await stripeConfig.paymentIntents
    .create({
      amount,
      currency: "EUR",
      confirm: true,
      payment_method: token,
    })
    .catch((err) => {
      console.log(err);
      throw new Error(err.message);
    });

  console.log(charge);

  const packageItems = basketItems.map((basketItem) => {
    const packageItem = {
      name: basketItem.present.name,
      body: basketItem.present.body,
      price: basketItem.present.price,
      quantity: basketItem.quantity,
      photo: { connect: { id: basketItem.present.photo.id } },
    };
    return packageItem;
  });

  const myPackage = await context.lists.Package.createOne({
    data: {
      total: charge.amount,
      charge: charge.id,
      items: { create: packageItems },
      user: { connect: { id: userId } },
    },
  });

  const basketItemIds = user.basket.map((basketItem) => basketItem.id);
  await context.lists.BasketItem.deleteMany({
    ids: basketItemIds,
  });
  return myPackage;
}

export default checkout;
