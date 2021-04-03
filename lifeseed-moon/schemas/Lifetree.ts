import { list } from '@keystone-next/keystone/schema';
import { text, relationship } from '@keystone-next/fields';

export const Lifetree = list({
  // access
  // ui
  fields: {
    lat: text({ isRequired: true }),
    long: text({ isRequired: true }),
    lid: text(),
  },
});
