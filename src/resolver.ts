import * as core from '@actions/core';
import type { GitHub } from '@actions/github/lib/utils';
import { parseLocationsFromBody, MANAGED_MARKER } from './issues.js';

type Octokit = InstanceType<typeof GitHub>;

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Remove a specific line from file content (1-based line number).
 * Returns the new content with the line removed.
 */
export function removeLineFromContent(
  content: string,
  lineNumber: number,
): string {
  const lines = content.split('\n');
  if (lineNumber < 1 || lineNumber > lines.length) {
    return content; // Invalid line number, return unchanged
  }
  lines.splice(lineNumber - 1, 1); // 0-based index
  return lines.join('\n');
}

// ── PR creation ────────────────────────────────────────────────────────────

/**
 * When a TODO issue is closed, create a PR that removes the TODO lines.
 */
export async function createResolutionPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<void> {
  // Fetch the issue
  const { data: issue } = await octokit.rest.issues.get({
    owner,
    repo,
    issue_number: issueNumber,
  });

  // Verify it's a bot-managed issue
  if (!issue.body || !issue.body.includes(MANAGED_MARKER)) {
    core.info(`Issue #${issueNumber} is not managed by doto-bot. Skipping.`);
    return;
  }

  // Parse locations from the issue body
  const locations = parseLocationsFromBody(issue.body);
  if (locations.length === 0) {
    core.warning(
      `No TODO locations found in issue #${issueNumber}. Skipping.`,
    );
    return;
  }

  core.info(
    `Found ${locations.length} TODO location(s) to remove for issue #${issueNumber}`,
  );

  // Get the default branch
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  // Get the latest commit SHA on the default branch
  const { data: ref } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });
  const baseSha = ref.object.sha;

  // Create a new branch for the PR
  const branchName = `doto-bot/resolve-issue-${issueNumber}`;

  try {
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
    core.info(`Created branch: ${branchName}`);
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 422) {
      core.info(`Branch ${branchName} already exists. Updating...`);
      await octokit.rest.git.updateRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
        sha: baseSha,
        force: true,
      });
    } else {
      throw err;
    }
  }

  // Group locations by file, sort lines descending (remove bottom-up)
  const fileGroups = new Map<string, number[]>();
  for (const loc of locations) {
    if (!fileGroups.has(loc.file)) {
      fileGroups.set(loc.file, []);
    }
    fileGroups.get(loc.file)!.push(loc.line);
  }

  for (const [file, lines] of fileGroups) {
    lines.sort((a, b) => b - a);

    try {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: file,
        ref: branchName,
      });

      if (!('content' in fileData) || fileData.type !== 'file') {
        core.warning(`${file} is not a regular file. Skipping.`);
        continue;
      }

      let content = Buffer.from(fileData.content, 'base64').toString('utf8');

      for (const lineNum of lines) {
        content = removeLineFromContent(content, lineNum);
      }

      await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: file,
        message: `Remove TODO from ${file} (resolves #${issueNumber})`,
        content: Buffer.from(content).toString('base64'),
        sha: fileData.sha,
        branch: branchName,
      });

      core.info(`Removed TODO line(s) from ${file}`);
    } catch (err: unknown) {
      if ((err as { status?: number }).status === 404) {
        core.warning(`File ${file} no longer exists. Skipping.`);
      } else {
        throw err;
      }
    }
  }

  // Create the pull request
  const { data: pr } = await octokit.rest.pulls.create({
    owner,
    repo,
    title: `Remove TODO: ${issue.title.replace('TODO: ', '')}`,
    body: `## Automated TODO Removal

This PR was automatically created by **doto-bot** because issue #${issueNumber} was closed.

### Changes
Removes the following TODO annotation(s):

${locations.map((l) => `- \`${l.file}\` line ${l.line}`).join('\n')}

---
Closes #${issueNumber}
`,
    head: branchName,
    base: defaultBranch,
  });

  core.info(`Created PR #${pr.number}: ${pr.html_url}`);

  // Comment on the issue
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body: `🤖 **doto-bot**: Created PR #${pr.number} to remove the TODO annotation(s) from the codebase.`,
  });
}
