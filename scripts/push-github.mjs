/**
 * Push the current git HEAD snapshot to GitHub through the REST API.
 *
 * The git wire protocol is blocked in this environment, so this script mirrors
 * what `git push` would do: it uploads only the blobs that differ from the remote
 * tree, builds a new tree on top of it, creates a commit and fast-forwards the
 * branch ref.
 *
 *   node scripts/push-github.mjs --owner <owner> --repo <repo> [--branch main]
 *
 * The token is read from GITHUB_TOKEN; it is never written into the repository.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const OWNER = arg('owner');
const REPO = arg('repo');
const BRANCH = arg('branch', 'main');
const MESSAGE = arg('message', 'chore: sync from local checkout');
const TOKEN = process.env.GITHUB_TOKEN;

if (!OWNER || !REPO || !TOKEN) {
  console.error('Usage: GITHUB_TOKEN=… node scripts/push-github.mjs --owner <owner> --repo <repo>');
  process.exit(1);
}

const H = {
  Authorization: 'Bearer ' + TOKEN,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'bancora-release',
  'Content-Type': 'application/json',
};

async function api(path, options = {}) {
  const response = await fetch('https://api.github.com' + path, { ...options, headers: H });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

const git = (...command) => execFileSync('git', command, { encoding: 'utf8', maxBuffer: 1 << 28 }).trim();

const localFiles = git('ls-files', '-z').split('\0').filter(Boolean);
const localBlob = new Map();
for (const file of localFiles) localBlob.set(file, git('hash-object', file));

const ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
if (ref.status === 404) {
  console.error(`Branch ${BRANCH} not found. Create the repository with an initial commit first.`);
  process.exit(1);
}
const parentSha = ref.body.object.sha;
const parent = await api(`/repos/${OWNER}/${REPO}/git/commits/${parentSha}`);
const baseTreeSha = parent.body.tree.sha;
const remoteTree = await api(`/repos/${OWNER}/${REPO}/git/trees/${baseTreeSha}?recursive=1`);
const remoteFiles = new Map();
for (const entry of remoteTree.body.tree ?? []) {
  if (entry.type === 'blob') remoteFiles.set(entry.path, entry.sha);
}

const tree = [];
let uploaded = 0;
for (const file of localFiles) {
  const localSha = localBlob.get(file);
  if (remoteFiles.get(file) === localSha) continue;
  const content = readFileSync(file).toString('base64');
  const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content, encoding: 'base64' }),
  });
  if (blob.status !== 201) {
    console.error('blob failed:', file, blob.status, JSON.stringify(blob.body).slice(0, 200));
    process.exit(1);
  }
  tree.push({ path: file, mode: '100644', type: 'blob', sha: blob.body.sha });
  uploaded += 1;
}

for (const path of remoteFiles.keys()) {
  if (!localBlob.has(path)) tree.push({ path, mode: '100644', type: 'blob', sha: null });
}

console.log(`changed blobs: ${uploaded} · deleted: ${[...remoteFiles.keys()].filter((p) => !localBlob.has(p)).length}`);

const newTree = await api(`/repos/${OWNER}/${REPO}/git/trees`, {
  method: 'POST',
  body: JSON.stringify({ base_tree: baseTreeSha, tree }),
});
if (newTree.status !== 201) {
  console.error('tree failed:', newTree.status, JSON.stringify(newTree.body).slice(0, 200));
  process.exit(1);
}

const commit = await api(`/repos/${OWNER}/${REPO}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({ message: MESSAGE, tree: newTree.body.sha, parents: [parentSha] }),
});
if (commit.status !== 201) {
  console.error('commit failed:', commit.status, JSON.stringify(commit.body).slice(0, 200));
  process.exit(1);
}

const update = await api(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
  method: 'PATCH',
  body: JSON.stringify({ sha: commit.body.sha, force: false }),
});
if (update.status !== 200) {
  console.error('ref update failed:', update.status, JSON.stringify(update.body).slice(0, 200));
  process.exit(1);
}

writeFileSync('.last-push.json', JSON.stringify({ commit: commit.body.sha, tree: newTree.body.sha, uploaded }, null, 2));
console.log('pushed', commit.body.sha, '→', `${OWNER}/${REPO}@${BRANCH}`);
