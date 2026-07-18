#!/usr/bin/env node
/**
 * Gather the earlier Lightseed repositories into one truthful Git DAG.
 *
 * This script is deliberately interactive. It clones the current local main into a separate
 * workspace, imports every source branch under history/* without rewriting commits, builds a
 * reviewed integration lineage beginning at the first Lightseed page, verifies that the final
 * tree is byte-for-byte the current app, and only then offers publishing and repository renames.
 *
 * It never deletes a directory, force-pushes, rebases, squashes, or writes to the source worktree.
 * Progress is recorded inside the consolidation clone's .git directory, so a declined checkpoint
 * or interrupted run can be resumed by launching the same command again.
 *
 *   npm run history:consolidate
 *   npm run history:consolidate -- --plan
 *   npm run history:consolidate -- --workspace /absolute/path
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const CURRENT_REPOSITORY = 'zetedi/lifeseed.online';
const CURRENT_REPOSITORY_URL = `https://github.com/${CURRENT_REPOSITORY}.git`;
const FINAL_REPOSITORY = 'zetedi/lightseed.online';
const ARCHIVE_REPOSITORY = 'zetedi/lightseed-online-2024';
const INTEGRATION_BRANCH = 'integration/code-lineage';
const FIRST_PAGE = '44f458064969b99f3462ea7649cfb3eb1e80cd2a';
const FIRST_PAGE_TAG = 'history/first-front-page';

const SOURCES = [
  {
    slug: 'lightseed-first',
    url: 'https://github.com/zetedi/lightseed.git',
    head: 'history/lightseed-first/master',
    role: 'the first page and earliest Lightseed code',
  },
  {
    slug: 'core-angular',
    url: 'https://github.com/zetedi/core.git',
    head: 'history/core-angular/master',
    role: 'the Angular ring',
  },
  {
    slug: 'light-functions',
    url: 'https://github.com/zetedi/light-functions.git',
    head: 'history/light-functions/master',
    role: 'the pulse server',
  },
  {
    slug: 'light-client',
    url: 'https://github.com/zetedi/light-client.git',
    head: 'history/light-client/master',
    role: 'the pulse client',
  },
  {
    slug: 'light-view',
    url: 'https://github.com/zetedi/light-view.git',
    head: 'history/light-view/master',
    role: 'the early light view',
  },
  {
    slug: 'lifeseed-full',
    url: 'https://github.com/zetedi/lifeseed.git',
    head: 'history/lifeseed-full/main',
    role: 'the complete pre-AI client/server application',
  },
  {
    slug: 'lightseed-online-restart',
    url: 'https://github.com/zetedi/lightseed.online.git',
    head: 'history/lightseed-online-restart/main',
    role: 'the clean 2024 restart',
  },
  {
    slug: 'lifeseed-g-test',
    url: 'https://github.com/zetedi/lifeseed-g.git',
    head: 'history/lifeseed-g-test/main',
    role: 'the small side experiment',
  },
];

const JOINS = [
  ['history/core-angular/master', 'The Angular ring joins the lineage.'],
  ['history/light-functions/master', 'The pulse functions join the lineage.'],
  ['history/light-client/master', 'The pulse client joins the lineage.'],
  ['history/light-view/master', 'The early light view joins the lineage.'],
  ['history/lifeseed-full/main', 'The full lifeseed joins the lineage.'],
];

const PLAN = [
  'Require a clean local main; clone it into a separate, resumable workspace.',
  'Fetch every source branch and tag into a permanent history/<repository>/* namespace.',
  `Tag ${FIRST_PAGE.slice(0, 8)} as ${FIRST_PAGE_TAG}.`,
  'Start the integration lineage at the original lightseed/master.',
  'Join Angular, pulse, view, and full client/server histories without changing the trunk tree.',
  'Adopt the clean lightseed.online restart as a deliberate snapshot transition.',
  'Join the lifeseed-g experiment and the current fixed-build-state branch.',
  'Adopt the current local main; its exact tree becomes the final integration tree.',
  'Verify every history branch is reachable, the final tree matches, fsck passes, and index.html reaches the first page.',
  'Audit suspicious historical paths; install and test the final current app.',
  'Optionally push namespaced history, open a PR or fast-forward main, then rename/archive repositories.',
];

const argv = process.argv.slice(2);
const failEarly = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};
const BOOLEAN_FLAGS = new Set(['--plan', '--skip-tests', '--local-only', '--no-rename', '--help']);
const VALUE_FLAGS = new Set(['--workspace']);
for (let index = 0; index < argv.length; index += 1) {
  const argument = argv[index];
  if (BOOLEAN_FLAGS.has(argument)) continue;
  if (VALUE_FLAGS.has(argument)) {
    index += 1;
    if (!argv[index] || argv[index].startsWith('--')) failEarly(`${argument} needs a value.`);
    continue;
  }
  failEarly(`Unknown option: ${argument}`);
}
const has = (flag) => argv.includes(flag);
const valueAfter = (flag) => {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  if (!argv[index + 1] || argv[index + 1].startsWith('--')) {
    throw new Error(`${flag} needs a value.`);
  }
  return argv[index + 1];
};

const HELP = `
Gather Lightseed's code histories without rewriting their commits.

Usage:
  node scripts/consolidate-code-history.mjs [options]

Options:
  --plan                 Print the passage without running commands.
  --workspace PATH       Use PATH for the separate consolidation clone.
  --skip-tests           Skip npm ci/check; publishing will remain disabled.
  --local-only           Build and verify locally, then stop before any push.
  --no-rename            Never offer the final GitHub repository renames.
  --help                 Show this help.

There is intentionally no --yes flag. Consequential steps require a present human.
`;

if (has('--help')) {
  console.log(HELP.trim());
  process.exit(0);
}

if (has('--plan')) {
  console.log('Lightseed code-history passage:\n');
  PLAN.forEach((step, index) => console.log(`${String(index + 1).padStart(2, ' ')}. ${step}`));
  process.exit(0);
}

if (!input.isTTY || !output.isTTY) {
  console.error('✗ This passage needs an interactive terminal; confirmations cannot be piped.');
  process.exit(1);
}

const colour = (code, text) => `\u001b[${code}m${text}\u001b[0m`;
const green = (text) => colour('32', text);
const amber = (text) => colour('33', text);
const cyan = (text) => colour('36', text);
const bold = (text) => colour('1', text);

const rl = createInterface({ input, output });

class GentleStop extends Error {}

const shellQuote = (value) => {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
};

const showCommand = (program, args) => {
  console.log(cyan(`$ ${[program, ...args].map(shellQuote).join(' ')}`));
};

function execute(program, args, options = {}) {
  const {
    cwd,
    capture = false,
    allowFailure = false,
    show = true,
    echoCaptured = false,
  } = options;

  if (show) showCommand(program, args);
  const result = spawnSync(program, args, {
    cwd,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: { ...process.env, GIT_PAGER: 'cat', GH_PAGER: 'cat', PAGER: 'cat' },
  });

  if (capture && echoCaptured) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }

  if (result.error && !allowFailure) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const detail = capture ? (result.stderr || result.stdout || '').trim() : '';
    throw new Error(`${program} exited ${result.status}${detail ? `: ${detail}` : ''}`);
  }
  return result;
}

const git = (args, cwd, options = {}) => execute('git', args, { cwd, ...options });
const gitText = (args, cwd, options = {}) =>
  git(args, cwd, { capture: true, show: false, ...options }).stdout.trim();

async function confirm(question) {
  const answer = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
  return answer === 'y' || answer === 'yes';
}

async function requirePhrase(question, phrase) {
  console.log(amber(question));
  const answer = (await rl.question(`Type ${bold(phrase)} to continue: `)).trim();
  return answer === phrase;
}

async function choose(question, choices) {
  console.log(`\n${bold(question)}`);
  choices.forEach((choice, index) => console.log(`  ${index + 1}. ${choice}`));
  const answer = Number.parseInt((await rl.question('Choose a number: ')).trim(), 10);
  return Number.isInteger(answer) && answer >= 1 && answer <= choices.length ? answer : 0;
}

function section(title, body) {
  console.log(`\n${bold(`── ${title} ──`)}`);
  if (body) console.log(body);
}

function stop(message) {
  console.log(`\n${amber(message)}`);
  throw new GentleStop();
}

function commandExists(program, args = ['--version']) {
  const result = execute(program, args, { capture: true, allowFailure: true, show: false });
  return result.status === 0;
}

let sourceRoot;
try {
  sourceRoot = gitText(['rev-parse', '--show-toplevel'], process.cwd());
} catch {
  console.error('✗ Run this script from the current lifeseed.online Git worktree.');
  process.exit(1);
}

const requestedWorkspace = valueAfter('--workspace');
const workspace = resolve(requestedWorkspace || join(dirname(sourceRoot), 'lightseed-consolidation'));
const workspaceRelation = relative(sourceRoot, workspace);
if (workspaceRelation === '' || (!workspaceRelation.startsWith('..') && !isAbsolute(workspaceRelation))) {
  failEarly('The consolidation workspace must be outside the source worktree.');
}
const sourceHead = gitText(['rev-parse', 'HEAD'], sourceRoot);
const statePath = join(workspace, '.git', 'lightseed-consolidation-state.json');

let state = { version: 1, sourceHead, completed: [] };

function loadState() {
  if (!existsSync(statePath)) return;
  state = JSON.parse(readFileSync(statePath, 'utf8'));
  if (state.sourceHead !== sourceHead) {
    throw new Error(
      `The source main changed from ${state.sourceHead?.slice(0, 12)} to ${sourceHead.slice(0, 12)}. ` +
      'Use a new --workspace so two passages are not silently mixed.',
    );
  }
}

function saveState() {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

const done = (key) => state.completed.includes(key);
const markDone = (key) => {
  if (!done(key)) state.completed.push(key);
  saveState();
  console.log(green(`✓ ${key}`));
};

async function guardedStep(key, title, description, action) {
  if (done(key)) {
    console.log(green(`↻ already complete: ${title}`));
    return;
  }
  section(title, description);
  if (!(await confirm('Proceed with this step?'))) stop(`Stopped before “${title}”. Rerun to resume.`);
  await action();
  markDone(key);
}

function refExists(ref, cwd = workspace) {
  return git(['show-ref', '--verify', '--quiet', `refs/heads/${ref}`], cwd, {
    capture: true,
    allowFailure: true,
    show: false,
  }).status === 0;
}

function exactRefExists(ref, cwd = workspace) {
  return git(['show-ref', '--verify', '--quiet', ref], cwd, {
    capture: true,
    allowFailure: true,
    show: false,
  }).status === 0;
}

function tagExists(tag, cwd = workspace) {
  return git(['show-ref', '--verify', '--quiet', `refs/tags/${tag}`], cwd, {
    capture: true,
    allowFailure: true,
    show: false,
  }).status === 0;
}

function isAncestor(ancestor, descendant = 'HEAD') {
  return git(['merge-base', '--is-ancestor', ancestor, descendant], workspace, {
    capture: true,
    allowFailure: true,
    show: false,
  }).status === 0;
}

function treesMatch(left, right) {
  return gitText(['rev-parse', `${left}^{tree}`], workspace) ===
    gitText(['rev-parse', `${right}^{tree}`], workspace);
}

function ensureNoMergeInProgress() {
  const mergeHead = gitText(['rev-parse', '--git-path', 'MERGE_HEAD'], workspace);
  if (existsSync(resolve(workspace, mergeHead))) {
    throw new Error(
      `A merge is still open in ${workspace}. Inspect it there; use “git merge --abort” only if you choose to discard it.`,
    );
  }
}

async function main() {
  section('The chart', `Source:    ${sourceRoot}\nWorkspace: ${workspace}\nSeed:      ${FIRST_PAGE.slice(0, 12)}…`);
  PLAN.forEach((step, index) => console.log(`  ${index + 1}. ${step}`));

  if (!commandExists('git')) throw new Error('git is required.');
  if (!commandExists('node')) throw new Error('node is required.');

  section(
    'Inspect the source main',
    'The source worktree must be clean and on main. The script itself should be reviewed and committed before this passage, so it remains in the final tree.',
  );
  if (!(await confirm('Run the source preflight?'))) stop('Stopped before inspecting the source.');
  const sourceBranch = gitText(['branch', '--show-current'], sourceRoot);
  const sourceDirty = gitText(['status', '--porcelain'], sourceRoot);
  console.log(`branch: ${sourceBranch}\nHEAD:   ${sourceHead}`);
  if (sourceBranch !== 'main') {
    throw new Error(`Source branch is ${sourceBranch || '(detached)'}, not main.`);
  }
  if (sourceDirty) throw new Error(`Source worktree is not clean:\n${sourceDirty}`);
  git(['status', '--short', '--branch'], sourceRoot);

  let createdWorkspace = false;
  if (!existsSync(workspace)) {
    section('Create the separate vessel', 'No source file will be edited. Git objects are copied without hardlinks.');
    if (!(await confirm(`Clone the clean local main into ${workspace}?`))) stop('Stopped before creating the workspace.');
    mkdirSync(dirname(workspace), { recursive: true });
    git(['clone', '--no-hardlinks', sourceRoot, workspace], dirname(workspace));
    createdWorkspace = true;
  } else if (!existsSync(join(workspace, '.git'))) {
    throw new Error(`${workspace} already exists but is not a Git worktree. Nothing was removed.`);
  } else {
    if (!existsSync(statePath)) {
      throw new Error(
        `${workspace} is a Git worktree but has no Lightseed consolidation state. ` +
        'Use a new --workspace; an unrelated worktree will never be adopted silently.',
      );
    }
    console.log(amber(`↻ Resuming the existing consolidation workspace at ${workspace}`));
  }

  if (!createdWorkspace && !existsSync(statePath)) {
    throw new Error(`Cannot safely resume ${workspace} without ${statePath}.`);
  }
  loadState();
  if (!done('source-preflight')) markDone('source-preflight');
  if (!done('workspace-created')) markDone('workspace-created');
  ensureNoMergeInProgress();

  await guardedStep(
    'origin-prepared',
    'Point the vessel toward the current GitHub repository',
    `The clone initially points to the local source. It will be changed to ${CURRENT_REPOSITORY_URL}, then fetched read-only.`,
    async () => {
      git(['remote', 'set-url', 'origin', CURRENT_REPOSITORY_URL], workspace);
      git(['fetch', 'origin', '--prune'], workspace);
      if (!isAncestor('origin/main', 'main')) {
        throw new Error(
          'GitHub origin/main contains commits absent from the local source main. ' +
          'Update and review the source main, then begin again in a new workspace.',
        );
      }

      if (!refExists('history/lifeseed-online-current/main')) {
        git(['branch', 'history/lifeseed-online-current/main', 'main'], workspace);
      }
      if (exactRefExists('refs/remotes/origin/fixed-build-state')) {
        if (!refExists('history/lifeseed-online-current/fixed-build-state')) {
          git([
            'branch',
            'history/lifeseed-online-current/fixed-build-state',
            'origin/fixed-build-state',
          ], workspace);
        }
      } else {
        console.log(amber('! origin/fixed-build-state is absent; there is no such current side branch to preserve.'));
      }
    },
  );

  for (const source of SOURCES) {
    await guardedStep(
      `fetch:${source.slug}`,
      `Fetch ${source.slug}`,
      `${source.role}\n${source.url}\nEvery source branch becomes history/${source.slug}/*; tags and pull-request heads are namespaced too.`,
      async () => {
        const remote = `source-${source.slug}`;
        const existing = execute('git', ['remote', 'get-url', remote], {
          cwd: workspace,
          capture: true,
          allowFailure: true,
          show: false,
        });
        if (existing.status !== 0) {
          git(['remote', 'add', remote, source.url], workspace);
        } else if (existing.stdout.trim() !== source.url) {
          throw new Error(`${remote} points to ${existing.stdout.trim()}, expected ${source.url}.`);
        }

        git([
          'fetch',
          remote,
          `+refs/heads/*:refs/heads/history/${source.slug}/*`,
          `+refs/pull/*/head:refs/heads/history/${source.slug}/pull/*`,
          `+refs/tags/*:refs/tags/history/${source.slug}/*`,
        ], workspace);
        git(['for-each-ref', '--format=%(refname:short)  %(objectname:short=12)  %(subject)', `refs/heads/history/${source.slug}/`], workspace);
      },
    );
  }

  await guardedStep(
    'tag:first-front-page',
    'Name the first front page',
    `${FIRST_PAGE} created the first index.html. The earlier 77971c2 commit contains only README.md.`,
    async () => {
      git(['cat-file', '-e', `${FIRST_PAGE}^{commit}`], workspace);
      git(['show', '--stat', '--oneline', '--decorate', FIRST_PAGE], workspace);
      if (tagExists(FIRST_PAGE_TAG)) {
        const target = gitText(['rev-parse', `${FIRST_PAGE_TAG}^{}`], workspace);
        if (target !== FIRST_PAGE) throw new Error(`${FIRST_PAGE_TAG} points to ${target}, not ${FIRST_PAGE}.`);
      } else {
        git(['tag', '-a', FIRST_PAGE_TAG, FIRST_PAGE, '-m', 'The first front page.'], workspace);
      }
    },
  );

  await guardedStep(
    'integration-started',
    'Step onto the first Lightseed branch',
    `Create ${INTEGRATION_BRANCH} from history/lightseed-first/master. The separate workspace will temporarily look like the 2020 site.`,
    async () => {
      if (refExists(INTEGRATION_BRANCH)) {
        git(['switch', INTEGRATION_BRANCH], workspace);
      } else {
        git(['switch', '-c', INTEGRATION_BRANCH, 'history/lightseed-first/master'], workspace);
      }
    },
  );

  if (gitText(['branch', '--show-current'], workspace) !== INTEGRATION_BRANCH) {
    git(['switch', INTEGRATION_BRANCH], workspace);
  }

  for (const [ref, message] of JOINS) {
    const key = `join:${ref}`;
    if (isAncestor(ref)) {
      if (!done(key)) markDone(key);
      continue;
    }
    await guardedStep(
      key,
      `Join ${ref}`,
      'This is an “ours” merge: the exact source DAG becomes ancestry, while the current trunk files remain untouched.',
      async () => {
        git(['show', '-s', '--format=%H%n%ad%n%s', '--date=iso-strict', ref], workspace);
        git(['merge', '-s', 'ours', '--no-ff', '--allow-unrelated-histories', '-m', message, ref], workspace);
      },
    );
  }

  const restartRef = 'history/lightseed-online-restart/main';
  if (!done('adopt:lightseed-online-restart') && isAncestor(restartRef) && treesMatch('HEAD', restartRef)) {
    markDone('adopt:lightseed-online-restart');
  }
  await guardedStep(
    'adopt:lightseed-online-restart',
    'Adopt the clean lightseed.online restart',
    'A merge commit will record both histories, then its tree will become the exact 2024–2025 restart snapshot.',
    async () => {
      git(['merge', '-s', 'ours', '--no-ff', '--no-commit', '--allow-unrelated-histories', restartRef], workspace);
      git(['read-tree', '--reset', '-u', restartRef], workspace);
      git(['status', '--short'], workspace);
      if (!(await confirm('The staged snapshot above is expected. Mint the bridge commit?'))) {
        git(['merge', '--abort'], workspace);
        stop('The uncommitted bridge was rolled back cleanly. Rerun to inspect and try again.');
      }
      git(['commit', '-m', 'Lightseed begins again.'], workspace);
    },
  );

  const laterJoins = [
    ['history/lifeseed-g-test/main', 'The test seed joins the lineage.'],
  ];
  if (refExists('history/lifeseed-online-current/fixed-build-state')) {
    laterJoins.push([
      'history/lifeseed-online-current/fixed-build-state',
      'The fixed build state is remembered.',
    ]);
  }

  for (const [ref, message] of laterJoins) {
    const key = `join:${ref}`;
    if (isAncestor(ref)) {
      if (!done(key)) markDone(key);
      continue;
    }
    await guardedStep(
      key,
      `Join ${ref}`,
      'The side branch becomes reachable without replacing the clean-restart trunk snapshot.',
      async () => git(['merge', '-s', 'ours', '--no-ff', '--allow-unrelated-histories', '-m', message, ref], workspace),
    );
  }

  const currentRef = 'history/lifeseed-online-current/main';
  if (!done('adopt:current-main') && isAncestor(currentRef) && treesMatch('HEAD', currentRef)) {
    markDone('adopt:current-main');
  }
  await guardedStep(
    'adopt:current-main',
    'Crown the lineage with the current application',
    'The final bridge records current main as a parent and adopts its exact tree. No current commit is rewritten.',
    async () => {
      git(['merge', '-s', 'ours', '--no-ff', '--no-commit', '--allow-unrelated-histories', currentRef], workspace);
      git(['read-tree', '--reset', '-u', currentRef], workspace);
      git(['status', '--short'], workspace);
      if (!(await confirm('The staged current-app snapshot is expected. Mint the final bridge commit?'))) {
        git(['merge', '--abort'], workspace);
        stop('The uncommitted final bridge was rolled back cleanly. Rerun to inspect and try again.');
      }
      git(['commit', '-m', 'The living application crowns the lineage.'], workspace);
    },
  );

  // GitHub pull refs and newly-created source branches may contain commits that are not on the
  // default branch. The reviewed inventory has none today, but “keep every commit” is stronger
  // than assuming that remains true. Attach any such tip after the current snapshot with an ours
  // merge: its exact DAG becomes reachable and the current application tree remains unchanged.
  const remainingRefs = gitText(
    ['for-each-ref', '--format=%(refname:short)', 'refs/heads/history/'],
    workspace,
  ).split('\n').filter(Boolean).filter((ref) => !isAncestor(ref));

  for (const ref of remainingRefs) {
    await guardedStep(
      `join:remaining:${ref}`,
      `Join otherwise-unreached history ${ref}`,
      'This branch or pull-request tip is not reachable through its source default branch. An ours merge preserves it without changing the final current-app tree.',
      async () => git([
        'merge', '-s', 'ours', '--no-ff', '--allow-unrelated-histories',
        '-m', `The branch ${ref} is remembered.`, ref,
      ], workspace),
    );
  }

  await guardedStep(
    'verification',
    'Verify the whole vessel',
    'This checks tree identity, reachability of every preserved branch, object integrity, and the visible index.html lineage.',
    async () => {
      git(['diff', '--exit-code', currentRef, 'HEAD'], workspace);
      console.log(green('✓ final tree is byte-for-byte the current application'));

      const refs = gitText(['for-each-ref', '--format=%(refname:short)', 'refs/heads/history/'], workspace)
        .split('\n')
        .filter(Boolean);
      const unreachable = refs.filter((ref) => !isAncestor(ref));
      if (unreachable.length) {
        throw new Error(`History branches not reachable from HEAD:\n${unreachable.join('\n')}`);
      }
      console.log(green(`✓ all ${refs.length} preserved history branches are reachable from HEAD`));

      if (!isAncestor(FIRST_PAGE)) throw new Error(`${FIRST_PAGE} is not an ancestor of HEAD.`);
      if (!isAncestor(currentRef)) throw new Error(`${currentRef} is not an ancestor of HEAD.`);
      git(['fsck', '--full'], workspace);

      const count = gitText(['rev-list', 'HEAD', '--count'], workspace);
      console.log(green(`✓ ${count} commits are reachable from the integration tip`));

      console.log(`\n${bold('index.html, newest to seed:')}`);
      git(['log', '--follow', '--date-order', '--date=short', '--format=%h %ad %s', '--', 'index.html'], workspace);
      console.log(`\n${bold('first page → current page:')}`);
      git(['diff', '--stat', `${FIRST_PAGE}:index.html`, 'HEAD:index.html'], workspace);
      git(['status', '--short', '--branch'], workspace);
    },
  );

  await guardedStep(
    'history-review',
    'Review security, integrity, architecture, and meaning',
    'Before publishing old history under one canonical name, inspect suspicious historical paths and the final graph. Existing public history can still contain credentials or oversized artifacts worth rotating or consciously accepting.',
    async () => {
      const objects = gitText(['rev-list', '--objects', '--all'], workspace);
      const paths = [...new Set(objects.split('\n').map((line) => line.slice(41)).filter(Boolean))];
      const suspicious = paths.filter((path) => {
        if (/\.env\.(example|sample|template)$/i.test(path)) return false;
        return /(^|\/)(\.env($|\.)|.*service.?account.*\.json$|.*credentials?.*\.(json|ya?ml)$|id_rsa$|.*\.(pem|p12|pfx|key))$/i.test(path);
      });

      if (suspicious.length) {
        console.log(amber('Potentially sensitive historical paths:'));
        suspicious.forEach((path) => console.log(`  ! ${path}`));
      } else {
        console.log(green('✓ no obviously sensitive filenames found by the basic path audit'));
      }

      git(['count-objects', '-vH'], workspace);
      git(['log', '--graph', '--decorate', '--oneline', '--all', '--max-count=100'], workspace);

      const accepted = await requirePhrase(
        'Confirm that you reviewed: correctness, architecture, security/data integrity, and whether this DAG truthfully expresses the project lineage.',
        'HISTORY REVIEWED',
      );
      if (!accepted) stop('Review was not attested; nothing will be published.');
    },
  );

  if (has('--skip-tests')) {
    console.log(amber('! Tests skipped by request. Publishing is disabled for this run.'));
  } else {
    await guardedStep(
      'quality-gate',
      'Install and test the final current tree',
      'Runs npm ci followed by the repository quality gate. Rules tests are unchanged and remain outside this consolidation.',
      async () => {
        if (!commandExists('npm')) throw new Error('npm is required for the quality gate.');
        execute('npm', ['ci'], { cwd: workspace });
        execute('npm', ['run', 'check'], { cwd: workspace });
        git(['diff', '--exit-code', currentRef, 'HEAD'], workspace);
      },
    );
  }

  if (has('--local-only')) stop('Local consolidation is complete. --local-only stopped before publishing.');
  if (has('--skip-tests') || !done('quality-gate')) stop('Publishing requires a completed quality gate.');

  await guardedStep(
    'published-history',
    'Publish the preserved histories and integration branch',
    `This writes new history/* refs, ${FIRST_PAGE_TAG}, and ${INTEGRATION_BRANCH} to ${CURRENT_REPOSITORY}. It does not move main.`,
    async () => {
      const accepted = await requirePhrase('This is the first external write.', 'PUSH HISTORY');
      if (!accepted) stop('Nothing was pushed.');
      git(['push', 'origin', 'refs/heads/history/*:refs/heads/history/*'], workspace);
      git(['push', 'origin', 'refs/tags/history/*:refs/tags/history/*'], workspace);
      git(['push', '-u', 'origin', INTEGRATION_BRANCH], workspace);
    },
  );

  git(['fetch', 'origin', 'main'], workspace);
  if (isAncestor(INTEGRATION_BRANCH, 'origin/main')) {
    if (!done('main-integrated')) markDone('main-integrated');
  } else {
    const mainChoice = await choose('How should main receive the lineage?', [
      'Open a pull request, then stop for human review (recommended)',
      'Fast-forward main directly after a typed confirmation',
      'Stop here; decide later',
    ]);

    if (mainChoice === 1) {
      if (!commandExists('gh')) throw new Error('GitHub CLI (gh) is required to create the pull request.');
      const result = execute('gh', [
        'pr', 'create',
        '--repo', CURRENT_REPOSITORY,
        '--base', 'main',
        '--head', INTEGRATION_BRANCH,
        '--title', 'The code remembers its roots',
        '--body', 'Preserves every earlier Lightseed repository as exact Git ancestry and leaves the final application tree unchanged. Merge normally; do not squash or rebase.',
      ], { cwd: workspace, allowFailure: true });
      if (result.status !== 0) {
        console.log(amber('A pull request may already exist. Inspect it with:'));
        console.log(`  gh pr view --repo ${CURRENT_REPOSITORY} --web`);
      }
      stop('Review and merge the PR normally—never squash or rebase—then rerun this script. It will verify origin/main before offering the rename.');
    }

    if (mainChoice === 2) {
      const accepted = await requirePhrase(
        'This moves the protected living branch. The working tree remains identical, but main gains all ancestry.',
        'FAST-FORWARD MAIN',
      );
      if (!accepted) stop('Main was not moved.');
      git(['switch', 'main'], workspace);
      git(['merge', '--ff-only', INTEGRATION_BRANCH], workspace);
      git(['push', 'origin', 'main'], workspace);
      markDone('main-integrated');
    } else if (mainChoice !== 1) {
      stop('Histories are published; main remains unchanged. Rerun when ready.');
    }
  }

  if (has('--no-rename')) stop('Main contains the lineage. --no-rename kept the repository names unchanged.');

  section(
    'Choose the final GitHub name',
    `Keeping ${CURRENT_REPOSITORY} is the minimum-change choice. Renaming gives the mature current organism the project’s lasting name, ${FINAL_REPOSITORY}.`,
  );
  if (!(await confirm(`Rename the final consolidated repository to ${FINAL_REPOSITORY}?`))) {
    stop(`Complete. The consolidated root remains at ${CURRENT_REPOSITORY}.`);
  }
  if (!commandExists('gh')) throw new Error('GitHub CLI (gh) is required for repository renames.');
  const renameAccepted = await requirePhrase(
    `The old ${FINAL_REPOSITORY} will first become ${ARCHIVE_REPOSITORY}. Reusing its former name intentionally replaces GitHub's old redirect.`,
    'RENAME THE ROOT',
  );
  if (!renameAccepted) stop('Repository names were not changed.');

  await guardedStep(
    'rename:old-restart',
    'Rename the 2024 restart repository',
    `${FINAL_REPOSITORY} → ${ARCHIVE_REPOSITORY}`,
    async () => execute('gh', ['repo', 'rename', '-R', FINAL_REPOSITORY, 'lightseed-online-2024', '--yes'], { cwd: workspace }),
  );

  if (!done('archive:old-restart')) {
    section('Archive the renamed restart', `Its commits now live in history/lightseed-online-restart/*, while its GitHub discussions remain readable at ${ARCHIVE_REPOSITORY}.`);
    if (await confirm(`Archive ${ARCHIVE_REPOSITORY}?`)) {
      execute('gh', ['repo', 'archive', ARCHIVE_REPOSITORY, '--yes'], { cwd: workspace });
    } else {
      console.log(amber('! The renamed restart was left writable.'));
    }
    markDone('archive:old-restart');
  }

  await guardedStep(
    'rename:current-root',
    'Give the mature repository its final name',
    `${CURRENT_REPOSITORY} → ${FINAL_REPOSITORY}`,
    async () => execute('gh', ['repo', 'rename', '-R', CURRENT_REPOSITORY, 'lightseed.online', '--yes'], { cwd: workspace }),
  );

  await guardedStep(
    'origin:final-url',
    'Update this consolidation clone’s origin',
    `origin → https://github.com/${FINAL_REPOSITORY}.git`,
    async () => git(['remote', 'set-url', 'origin', `https://github.com/${FINAL_REPOSITORY}.git`], workspace),
  );

  section('Land', `${green('✓ The code histories share one root.')}\n\nFinal repository: https://github.com/${FINAL_REPOSITORY}\nArchive:          https://github.com/${ARCHIVE_REPOSITORY}\nWorkspace:        ${workspace}`);
  console.log('\nNext conscious change: update the hardcoded GitHub URL in src/components/community/CommunityCodeChain.tsx, review, test, and commit it as its own ring.');
}

try {
  await main();
} catch (error) {
  if (!(error instanceof GentleStop)) {
    console.error(`\n${colour('31', `✗ ${error.message}`)}`);
    process.exitCode = 1;
  }
} finally {
  rl.close();
}
