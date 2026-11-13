// THE OLD NAME (ring 2026-11-03): main.mjs, the test harness and the Docker proof call `createDatabase`;
// since the API found its layers the doors live in node.mjs (services, no statements) over the
// repositories in db/ (every statement). This file keeps the name so nothing that calls it has to move.
export {createNode as createDatabase} from './node.mjs';
