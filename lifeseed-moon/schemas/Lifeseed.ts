import { list } from '@keystone-next/keystone/schema';
import { text, password, relationship } from '@keystone-next/fields';
import { permissions, rules } from '../access';

export const Lifeseed = list({
  access: {
    create: () => true,
    read: rules.canManageLifeseeds,
    update: rules.canManageLifeseeds,
    delete: permissions.canManageLifeseeds,
  },
  ui: {
    hideCreate: (args) => !permissions.canManageLifeseeds(args),
    hideDelete: (args) => !permissions.canManageLifeseeds(args),
  },
  fields: {
    name: text({ isRequired: true }),
    email: text({ isRequired: true, isUnique: true }),
    password: password(),
    basket: relationship({
      ref: 'BasketItem.lifeseed',
      many: true,
      ui: {
        createView: { fieldMode: 'hidden' },
        itemView: { fieldMode: 'read' },
      },
    }),
    role: relationship({
      ref: 'Role.assignedTo',
      access: {
        create: permissions.canManageLifeseeds,
        update: permissions.canManageLifeseeds,
      },
    }),
    lifetree: relationship({ ref: 'Lifetree.lifeseed' }),
    loves: relationship({ ref: 'Love.lifeseed', many: true }),
    packages: relationship({ ref: 'Package.lifeseed', many: true }),
    presents: relationship({ ref: 'Present.lifeseed', many: true }),
  },
});
