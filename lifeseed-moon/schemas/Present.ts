import { integer, relationship, select, text } from '@keystone-next/fields';
import { list } from '@keystone-next/keystone/schema';
import { isSignedIn, rules } from '../access';

export const Present = list({
  access: {
    create: isSignedIn,
    read: rules.canReadPresents,
    update: rules.canManagePresents,
    delete: rules.canManagePresents,
  },
  ui: {
    listView: {
      initialColumns: ['name', 'body', 'photo', 'price', 'status'],
    },
  },
  fields: {
    name: text({ isRequired: true }),
    body: text({
      ui: {
        displayMode: 'textarea',
      },
    }),
    comments: relationship({ ref: 'Comment.present', many: true }),
    image: text({ isRequired: false }),
    photo: relationship({
      ref: 'PresentImage.present',
      ui: {
        displayMode: 'cards',
        cardFields: ['image', 'altText'],
        inlineCreate: { fields: ['image', 'altText'] },
        inlineEdit: { fields: ['image', 'altText'] },
      },
    }),
    creationTime: text({ isRequired: true }),
    status: select({
      options: [
        {
          label: 'Draft',
          value: 'DRAFT',
        },
        {
          label: 'Available',
          value: 'AVAILABLE',
        },
        {
          label: 'Unavailable',
          value: 'UNAVAILABLE',
        },
      ],
      defaultValue: 'DRAFT',
      ui: {
        displayMode: 'segmented-control',
        createView: { fieldMode: 'hidden' },
      },
    }),
    type: select({
      options: [
        {
          label: 'Offer',
          value: 'OFFER',
        },
        {
          label: 'Message',
          value: 'MESSAGE',
        },
      ],
      defaultValue: 'MESSAGE',
      ui: {
        displayMode: 'segmented-control',
        createView: { fieldMode: 'hidden' },
      },
    }),
    price: integer(),
    lifeseed: relationship({
      ref: 'Lifeseed.presents',
      defaultValue: ({ context }) => ({
        connect: { id: context.session.itemId },
      }),
    }),
  },
});
