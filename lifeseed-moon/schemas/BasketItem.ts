import { integer, relationship, select, text } from '@keystone-next/fields';
import { list } from '@keystone-next/keystone/schema';
import { isSignedIn, rules } from '../access';

export const BasketItem = list({
  access: {
    create: isSignedIn,
    read: rules.canPackage,
    update: rules.canPackage,
    delete: rules.canPackage,
  },
  ui: {
    listView: {
      initialColumns: ['present', 'quantity', 'user'],
    },
  },
  fields: {
    // TODO: custom label is here
    quantity: integer({
      defaultValue: 1,
      isRequired: true,
    }),
    present: relationship({ ref: 'Present' }),
    user: relationship({ ref: 'User.basket' }),
  },
});
