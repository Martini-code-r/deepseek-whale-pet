'use strict';

/**
 * Upload the working tree to GitHub using only the REST API.
 *
 * Some networks block github.com:443 (git push / OAuth token exchange) while
 * api.github.com remains reachable. This script builds one commit with the Git
 * Data API and creates the repository if needed, so it does not require git push.
 *
 * Usage:
 *   1. Save a classic PAT with `repo` scope to ..\github-token.txt
 *   2. node scripts/upload-github.js
 *   3. Delete the token file afterwards.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const tokenFile = process.env.GITHUB_TOKEN_FILE || path.resolve(root, '..', 'github-token.txt');
const repoName = process.env.REPO_NAME || 'deepseek-whale-pet';
const isPrivate = process.env.REPO_PRIVATE === '1';
const commitMessage = process.env.COMMIT_MESSAGE || 'feat: Q版 DeepSeek 鲸鱼娘溟月桌面宠物';
const token = (() => {
  try {
    return fs.readFileSync(tokenFile, 'utf8').trim();
  } catch {
    console.error(`Token file not found: ${tokenFile}`);
    process.exit(2);
  }
})();
if (!token) {
  console.error('Token file is empty.');
  process.exit(2);
}

const API = 'https://api.github.com';
async function api(endpoint, options = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'mingyue-desktop-pet-uploader',
    ...(options.headers || {})
  };
  if (options.body && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(API + endpoint, { ...options, headers });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status} ${endpoint}: ${data && data.message ? data.message : text}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

(async () => {
  const user = await api('/user');
  const owner = user.login;
  console.log(`Authenticated as ${owner}`);

  let repo = null;
  try {
    repo = await api(`/repos/${owner}/${repoName}`);
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  if (repo) {
    console.log(`Repository already exists: ${repo.html_url}`);
  } else {
    repo = await api('/user/repos', {
      method: 'POST',
      body: {
        name: repoName,
        description: 'Q版 DeepSeek 鲸鱼娘「溟月」桌面宠物 · Electron / Windows',
        private: isPrivate,
        has_issues: true,
        has_wiki: false,
        has_projects: false,
        auto_init: false
      }
    });
    console.log(`Created repository: ${repo.html_url}`);
  }

  // The Git Data API refuses to create blobs in a completely empty repository.
  // Seed one commit through the Contents API, then replace its tree with ours.
  let parentSha = null;
  try {
    const commits = await api(`/repos/${owner}/${repoName}/commits?per_page=1`);
    if (Array.isArray(commits) && commits.length) parentSha = commits[0].sha;
  } catch (err) {
    if (err.status !== 404 && err.status !== 409) throw err;
  }
  if (repo && parentSha && process.env.ALLOW_UPDATE !== '1') {
    console.error('The repository already has commits; refusing to overwrite its history.');
    console.error('Run with ALLOW_UPDATE=1 to add a fast-forward commit instead.');
    process.exit(3);
  }
  if (!parentSha) {
    const seed = await api(`/repos/${owner}/${repoName}/contents/.init`, {
      method: 'PUT',
      body: {
        message: 'chore: initialize repository',
        content: Buffer.from('init\n').toString('base64'),
        branch: 'main'
      }
    });
    parentSha = seed.commit.sha;
    console.log(`Initialized repository at ${parentSha.slice(0, 7)}`);
  }

  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root })
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  if (!files.length) throw new Error('No staged files found. Run `git add .` first.');
  console.log(`Uploading ${files.length} files...`);

  const tree = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(root, file));
    const blob = await api(`/repos/${owner}/${repoName}/git/blobs`, {
      method: 'POST',
      body: { content: content.toString('base64'), encoding: 'base64' }
    });
    tree.push({ path: file, mode: '100644', type: 'blob', sha: blob.sha });
    process.stdout.write('.');
  }
  console.log('');

  const treeResult = await api(`/repos/${owner}/${repoName}/git/trees`, {
    method: 'POST',
    body: { tree }
  });
  const commit = await api(`/repos/${owner}/${repoName}/git/commits`, {
    method: 'POST',
    body: {
      message: commitMessage,
      tree: treeResult.sha,
      parents: parentSha ? [parentSha] : [],
      author: { name: owner, email: `${owner}@users.noreply.github.com` },
      committer: { name: owner, email: `${owner}@users.noreply.github.com` }
    }
  });

  try {
    await api(`/repos/${owner}/${repoName}/git/refs`, {
      method: 'POST',
      body: { ref: 'refs/heads/main', sha: commit.sha }
    });
  } catch (err) {
    if (err.status !== 422) throw err;
    await api(`/repos/${owner}/${repoName}/git/refs/heads/main`, {
      method: 'PATCH',
      body: { sha: commit.sha }
    });
  }

  try {
    await api(`/repos/${owner}/${repoName}`, {
      method: 'PATCH',
      body: { default_branch: 'main' }
    });
    await api(`/repos/${owner}/${repoName}/topics`, {
      method: 'PUT',
      body: { names: ['desktop-pet', 'electron', 'deepseek', 'chibi', 'windows'] }
    });
  } catch (err) {
    console.warn(`Optional repository settings skipped: ${err.message}`);
  }

  console.log(`DONE ${repo.html_url}`);
  console.log(`Commit ${commit.sha}`);
  try { fs.unlinkSync(tokenFile); console.log('Token file removed.'); } catch {}
})().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
