import { relationship, select, text } from '@keystone-next/fields';
import { list } from '@keystone-next/keystone/schema';
import { isSignedIn, rules } from '../access';

export const Lifetree = list({
  access: {
    create: isSignedIn,
    read: rules.canReadPresents,
    update: rules.canManagePresents,
    delete: rules.canManagePresents,
  },
  ui: {
    listView: {
      initialColumns: ['name', 'body', 'latitude', 'longitude', 'status'],
    },
  },
  fields: {
    name: text({ isRequired: true }),
    body: text({
      ui: {
        displayMode: 'textarea',
      },
    }),
    image: text({ isRequired: false }),
    status: select({
      options: [
        {
          label: 'Alive',
          value: 'ALIVE',
        },
        {
          label: 'Validated',
          value: 'VALIDATED',
        },
      ],
      defaultValue: 'ALIVE',
      ui: {
        displayMode: 'segmented-control',
        createView: { fieldMode: 'hidden' },
      },
    }),
    latitude: text(),
    longitude: text(),
    lifeseed: relationship({
      ref: 'Lifeseed.lifetree',
      defaultValue: ({ context }) => ({
        connect: { id: context.session.itemId },
      }),
    }),
  },
});
