// THE ONE LAW (2026-11-14). THE TREE KINDS THAT ROOT A BEING are src/domain/secretTree's.
// The functions build compiles the shared domain itself (tsconfig rootDir '..'): the server judges by the
// very source the shell and the independent node judge by. Add law to src/domain, never here.
import { isSecretTree } from '../../src/domain/secretTree';
export { SECRET_TREE_TYPE, MAX_SECRET_TREES, isSecretTree, rootsABeing, OPEN_LINKS, SECRET_LINKS, circleLedgerFor } from '../../src/domain/secretTree';
// A secret tree's only seat is keeping (the server's yes/no reading of domain/secretTree invitableRolesFor).
export const secretRoleAllowed = (t: Parameters<typeof isSecretTree>[0], role: unknown): boolean =>
    !isSecretTree(t) || role === "keeper";
