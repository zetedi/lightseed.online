import { permissionsList } from './schemas/PermissionFields';
import { ListAccessArgs } from './types';

export function isSignedIn({ session }: ListAccessArgs) {
  return !!session;
}

const generatedPermissions = Object.fromEntries(
  permissionsList.map((permission) => [
    permission,
    function ({ session }: ListAccessArgs) {
      return !!session?.data.role?.[permission];
    },
  ])
);

export const permissions = {
  ...generatedPermissions,
  // isPermissionExample({ session }: ListAccessArgs): boolean {
  //   return session?.data.name.includes('example');
  // },
};

export const rules = {
  canManagePresents({ session }: ListAccessArgs) {
    if (!isSignedIn({ session })) {
      return false;
    }
    if (permissions.canManagePresents({ session })) {
      return true;
    }

    return { lifeseed: { id: session.itemId } };
  },

  canManageComments({ session }: ListAccessArgs) {
    if (!isSignedIn({ session })) {
      return false;
    }
    if (permissions.canManageComments({ session })) {
      return true;
    }

    return { lifeseed: { id: session.itemId } };
  },

  canPackage({ session }: ListAccessArgs) {
    if (!isSignedIn({ session })) {
      return false;
    }
    if (permissions.canManageBasket({ session })) {
      return true;
    }

    return { lifeseed: { id: session.itemId } };
  },

  canManagePackageItems({ session }: ListAccessArgs) {
    if (!isSignedIn({ session })) {
      return false;
    }
    if (permissions.canManageBasket({ session })) {
      return true;
    }

    return { package: { lifeseed: { id: session.itemId } } };
  },

  canReadPresents({ session }: ListAccessArgs) {
    if (!isSignedIn({ session })) {
      return true;
    }
    if (permissions.canManagePresents({ session })) {
      return true;
    }

    return { status: 'AVAILABLE' };
  },

  canManageLifeseeds({ session }: ListAccessArgs) {
    if (!isSignedIn({ session })) {
      return false;
    }
    if (permissions.canManageLifeseeds({ session })) {
      return true;
    }

    return { id: session.itemId };
  },
};
