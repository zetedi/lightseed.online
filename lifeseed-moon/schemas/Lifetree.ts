import { integer, relationship, select, text } from '@keystone-next/fields';
import { list } from '@keystone-next/keystone/schema';
import { isSignedIn, rules } from '../access';

export const LifeTree = list({
  access: {
    create: isSignedIn,
    read: rules.canReadProducts,
    update: rules.canManageProducts,
    delete: rules.canManageProducts,
  },
  ui: {
    listView: {
      initialColumns: [
        'name',
        'description',
        'photo',
        'latitude',
        'longitude',
        'status',
      ],
    },
  },
  fields: {
    name: text({ isRequired: true }),
    description: text({
      ui: {
        displayMode: 'textarea',
      },
    }),
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
