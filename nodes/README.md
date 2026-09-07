# nodes/

The charters this repo knows. The origin node's charter is the repo root's `node.json`;
every other node the same code runs as keeps its charter here, one folder per node id.

To build and deploy AS a node other than the origin, point the tools at its charter:

```bash
NODE_CHARTER=nodes/theohouse/node.json npm run charter      # derive the files that must agree
NODE_CHARTER=nodes/theohouse/node.json npm run build        # the shell wears that charter
FIREBASE_ACCOUNT=admin@theohouse.org NODE_CHARTER=nodes/theohouse/node.json npm run node:create -- --apply
npm run charter                                             # back to the origin's
```

A node's secrets stand beside its charter as `node.secrets.json` (gitignored) and become
functions secrets on the node's project. The `web` config is written back by create-node
once the project's web app exists; until then the charter is deliberately unsound.
