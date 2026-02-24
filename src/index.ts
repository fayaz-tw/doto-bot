import * as core from '@actions/core';
import * as github from '@actions/github';
import { scanRepository, groupTodosByDescription } from './scanner.js';
import { syncIssues } from './issues.js';
import { createResolutionPR } from './resolver.js';

type Octokit = ReturnType<typeof github.getOctokit>;

async function run(): Promise<void> {
  try {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      core.setFailed('GITHUB_TOKEN environment variable is required.');
      return;
    }

    const octokit = github.getOctokit(token);
    const { owner, repo } = github.context.repo;
    const mode = core.getInput('mode') || 'scan';

    core.info(`Running doto-bot in "${mode}" mode`);
    core.info(`Repository: ${owner}/${repo}`);

    if (mode === 'scan') {
      await handleScan(octokit, owner, repo);
    } else if (mode === 'resolve') {
      const issueNumber = parseInt(core.getInput('issue-number'), 10);
      if (!issueNumber) {
        core.setFailed('issue-number input is required for resolve mode.');
        return;
      }
      await handleResolve(octokit, owner, repo, issueNumber);
    } else {
      core.setFailed(`Unknown mode: ${mode}. Use "scan" or "resolve".`);
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    core.setFailed(`doto-bot failed: ${err.message}`);
    if (err.stack) core.error(err.stack);
  }
}

/**
 * Handle the "scan" mode:
 * 1. Scan the repository for TODO annotations
 * 2. Group TODOs by description
 * 3. Sync GitHub issues (create, update, close stale)
 */
async function handleScan(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<void> {
  try {
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const defaultBranch = repoData.default_branch;

    // Verify we are on the default branch
    const currentRef = github.context.ref;
    const expectedRef = `refs/heads/${defaultBranch}`;
    if (currentRef !== expectedRef) {
      core.info(
        `Current ref (${currentRef}) is not the default branch (${expectedRef}). Skipping scan.`,
      );
      return;
    }

    core.info(`Default branch: ${defaultBranch}`);

    const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
    const todos = scanRepository(workspacePath);

    if (todos.length === 0) {
      core.info('No TODO annotations found in the repository.');
      core.info('=== Doto Bot Scan Complete ===');
      return;
    }

    const todoGroups = groupTodosByDescription(todos);
    core.info(`Grouped into ${todoGroups.size} unique TODO(s)`);

    await syncIssues(octokit, owner, repo, todoGroups, defaultBranch);

    core.info('=== Doto Bot Scan Complete ===');
    core.info(`Total TODOs found: ${todos.length}`);
    core.info(`Unique TODOs: ${todoGroups.size}`);
  } catch (innerError: unknown) {
    const err = innerError instanceof Error ? innerError : new Error(String(innerError));
    core.error(`Scan failed: ${err.message}`);
    if (err.stack) core.debug(err.stack);
    throw err;
  }
}

/**
 * Handle the "resolve" mode:
 * Create a PR to remove TODO lines when an issue is closed.
 */
async function handleResolve(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<void> {
  try {
    core.info(`Resolving TODO for issue #${issueNumber}`);
    await createResolutionPR(octokit, owner, repo, issueNumber);
    core.info('=== Doto Bot Resolve Complete ===');
  } catch (innerError: unknown) {
    const err = innerError instanceof Error ? innerError : new Error(String(innerError));
    core.error(`Resolve failed: ${err.message}`);
    if (err.stack) core.debug(err.stack);
    throw err;
  }
}

run();
