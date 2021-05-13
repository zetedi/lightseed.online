import { list } from '@keystone-next/keystone/schema';
import { text, relationship } from '@keystone-next/fields';
import { permissions, isSignedIn, rules } from '../access';

export const Love = list({
  access: {
    create: isSignedIn,
    read: rules.canReadPresents,
    update: rules.canReadPresents,
    delete: rules.canReadPresents,
  },
  ui: {
    hideCreate: (args) => !permissions.canManagePresents(args),
    hideDelete: (args) => !permissions.canManagePresents(args),
  },
  fields: {
    creationTime: text({ isRequired: true }),
    lifeseed: relationship({
      ref: 'Lifeseed.loves',
      many: false,
      defaultValue: ({ context }) => ({
        connect: { id: context.session.itemId },
      }),
    }),
    present: relationship({ ref: 'Present.loves', many: false }),
  },
});
