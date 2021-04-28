import { checkbox } from '@keystone-next/fields';

export const permissionFields = {
  canManagePresents: checkbox({
    defaultValue: false,
    label: 'User can Update and delete any present',
  }),
  canSeeOtherUsers: checkbox({
    defaultValue: false,
    label: 'User can query other users',
  }),
  canManageUsers: checkbox({
    defaultValue: false,
    label: 'User can Edit other users',
  }),
  canManageRoles: checkbox({
    defaultValue: false,
    label: 'User can CRUD roles',
  }),
  canManageBasket: checkbox({
    defaultValue: false,
    label: 'User can see and manage basket and basket items',
  }),
  canManagePackages: checkbox({
    defaultValue: false,
    label: 'User can see and manage packages',
  }),
};

export type Permission = keyof typeof permissionFields;

export const permissionsList: Permission[] = Object.keys(
  permissionFields
) as Permission[];
