import { createAuth } from '@keystone-next/auth';
import { config, createSchema } from '@keystone-next/keystone/schema';
import {
  withItemData,
  statelessSessions,
} from '@keystone-next/keystone/session';
import { Present } from './schemas/Present';
import { CloudinaryImage } from './schemas/CloudinaryImage';
import { Lifeseed } from './schemas/Lifeseed';
import { Love } from './schemas/Love';
import { Role } from './schemas/Role';
import { Lifetree } from './schemas/Lifetree';
import { Comment } from './schemas/Comment';
import { BasketItem } from './schemas/BasketItem';
import { PackageItem } from './schemas/PackageItem';
import { Package } from './schemas/Package';
import 'dotenv/config';
import { insertSeedData } from './seed-data';
import { sendPasswordResetEmail } from './lib/mail';
import { extendGraphqlSchema } from './mutations';
import { permissionsList } from './schemas/PermissionFields';

const databaseURL = process.env.DATABASE_URL;

const sessionConfig = {
  maxAge: 60 * 60 * 24 * 360,
  secret: process.env.COOKIE_SECRET,
};

const { withAuth } = createAuth({
  listKey: 'Lifeseed',
  identityField: 'email',
  secretField: 'password',
  initFirstItem: {
    fields: ['name', 'email', 'password'],
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    },
  },
});

export default withAuth(
  config({
    server: {
      cors: {
        origin: [process.env.FRONTEND_URL],
        credentials: true,
      },
    },
    db: {
      adapter: 'mongoose',
      url: databaseURL,
      async onConnect(keystone) {
        console.log('Connected to the database!');
        if (process.argv.includes('--seed-data')) {
          await insertSeedData(keystone);
        }
      },
    },
    lists: createSchema({
      BasketItem,
      Comment,
      Lifeseed,
      Lifetree,
      CloudinaryImage,
      Love,
      Package,
      PackageItem,
      Present,
      Role,
    }),
    extendGraphqlSchema,
    ui: {
      isAccessAllowed: ({ session }) => !!session?.data,
    },
    session: withItemData(statelessSessions(sessionConfig), {
      Lifeseed: `id name email role { ${permissionsList.join(' ')}}`,
    }),
  })
);
