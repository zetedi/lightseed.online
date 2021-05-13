import { integer, relationship, select, text } from '@keystone-next/fields';
import { list } from '@keystone-next/keystone/schema';
import { isSignedIn, rules } from '../access';

export const PackageItem = list({
  access: {
    create: isSignedIn,
    read: rules.canManagePackageItems,
    update: () => false,
    delete: () => false,
  },
  fields: {
    name: text({ isRequired: true }),
    body: text({
      ui: {
        displayMode: 'textarea',
      },
    }),
    price: integer(),
    quantity: integer(),
    package: relationship({ ref: 'Package.items' }),
  },
});
