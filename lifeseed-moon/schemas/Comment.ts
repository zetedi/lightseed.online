import { list } from '@keystone-next/keystone/schema';
import { text, relationship } from '@keystone-next/fields';
import { permissions, isSignedIn, rules } from '../access';

export const Comment = list({
  access: {
    create: isSignedIn,
    read: rules.canReadPresents,
    update: rules.canManagePresents,
    delete: rules.canManagePresents,
  },
  ui: {
    hideCreate: (args) => !permissions.canManagePresents(args),
    hideDelete: (args) => !permissions.canManagePresents(args),
  },
  fields: {
    body: text({ isRequired: true }),
    creationTime: text({ isRequired: true }),
    lifeseed: relationship({
      ref: 'Lifeseed.comments',
      defaultValue: ({ context }) => ({
        connect: { id: context.session.itemId },
      }),
    }),
    present: relationship({ ref: 'Present.comments', many: false }),
  },
});
