import { checkbox } from '@keystone-next/fields';

export const permissionFields = {
  canManagePresents: checkbox({
    defaultValue: false,
    label: 'present manager',
  }),
  canManageComments: checkbox({
    defaultValue: false,
    label: 'comment manager',
  }),
  canSeeOtherLifeseeds: checkbox({
    defaultValue: false,
    label: 'view lifeseeds',
  }),
  canManageLifeseeds: checkbox({
    defaultValue: false,
    label: 'edit lifeseeds',
  }),
  canManageLifetrees: checkbox({
    defaultValue: false,
    label: 'edit lifetrees',
  }),
  canManageRoles: checkbox({
    defaultValue: false,
    label: 'role manager',
  }),
  canManageBasket: checkbox({
    defaultValue: false,
    label: 'basket and basket item manager',
  }),
  canManagePackages: checkbox({
    defaultValue: false,
    label: 'package manager',
  }),
};

export type Permission = keyof typeof permissionFields;

export const permissionsList: Permission[] = Object.keys(
  permissionFields
) as Permission[];
