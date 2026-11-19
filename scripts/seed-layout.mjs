// WHERE AN INSTALLED NODE KEEPS ITS THINGS — one table for the hand that installs
// (install-seed.mjs) and the hand that removes (uninstall-seed.mjs), so the two cannot drift.
// By default the places the README names, so every later `docker compose …` in seed/ and every
// `npm run seed:*` finds the node without ceremony. With a directory, that one private directory
// holds everything.
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const seed = join(root, 'seed');
// The first line of the private Compose override: the mark by which the remover knows a node
// the installer made from one made by hand, and WHICH Compose project is that node's — read from
// the installation itself, never guessed, so the remover cannot be pointed at another node.
export const INSTALL_MARK = '# Written by seed:install';
export const installedProjectOf = override => {
  const name = override.split('\n')[0].match(/^# Written by seed:install for the Compose project "([^"]+)"/)?.[1];
  return name && PROJECT_NAME.test(name) ? name : null;
};
export const PROJECT_NAME = /^[a-z0-9][a-z0-9_-]{0,40}$/;

export const seedLayoutOf = ({ dir, project = 'seed' }) => {
  const home = dir ? resolve(dir) : null;
  const priv = home ?? join(seed, 'local');
  const paths = home ? {
    env: join(home, '.env'), runtime: join(home, 'runtime.env'), charter: join(home, 'charter'),
    identityEnv: join(home, 'identity.env'), override: join(home, 'compose.override.yml'), dist: join(home, 'dist'),
  } : {
    env: join(seed, '.env'), runtime: join(seed, 'runtime.env'), charter: join(seed, 'charter'),
    identityEnv: join(seed, 'identity', '.env'), override: join(seed, 'compose.local.yml'), dist: join(root, 'dist-independent'),
  };
  Object.assign(paths, {
    node: join(priv, 'node.json'), auth: join(priv, 'auth.json'), realm: join(priv, 'lightseed-realm.json'),
    login: join(priv, 'first-login.txt'), rootCert: join(priv, 'caddy-root.crt'),
  });
  return {
    home, priv, paths, project,
    identityProject: project === 'seed' ? 'identity' : `${project}-identity`,
    // A bind mount under Docker Desktop (macOS) breaks initdb on ownership, and a second node must
    // never share seed/data: the documented ./data mount stays only for the default node on Linux.
    namedVolume: process.platform !== 'linux' || !!home,
  };
};
