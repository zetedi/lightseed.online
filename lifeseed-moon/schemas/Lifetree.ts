import { integer, relationship, select, text } from '@keystone-next/fields';
import { list } from '@keystone-next/keystone/schema';
import { isSignedIn, rules } from '../access';

export const LifeTree = list({
  access: {
    create: isSignedIn,
    read: rules.canReadPresents,
    update: rules.canManagePresents,
    delete: rules.canManagePresents,
  },
  ui: {
    listView: {
      initialColumns: [
        'name',
        'body',
        'photo',
        'latitude',
        'longitude',
        'status',
      ],
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
    photo: relationship({
      ref: 'LifeTreeImage.lifeTree',
      ui: {
        displayMode: 'cards',
        cardFields: ['image', 'altText'],
        inlineCreate: { fields: ['image', 'altText'] },
        inlineEdit: { fields: ['image', 'altText'] },
      },
    }),
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
    user: relationship({
      ref: 'User.lifeTree',
      defaultValue: ({ context }) => ({
        connect: { id: context.session.itemId },
      }),
    }),
  },
});
