import * as core from '@actions/core';
import type { GitHub } from '@actions/github/lib/utils';
import type { TodoGroup, TodoLocation } from './scanner.js';

// ── Types ──────────────────────────────────────────────────────────────────

type Octokit = InstanceType<typeof GitHub>;

export interface ParsedLocation {
  file: string;
  line: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

export const TODO_LABEL = 'todo';
export const ISSUE_TITLE_PREFIX = 'TODO: ';
export const MANAGED_MARKER = '<!-- doto-bot-managed -->';
export const LOCATIONS_START = '<!-- doto-locations-start -->';
export const LOCATIONS_END = '<!-- doto-locations-end -->';

// ── Label management ───────────────────────────────────────────────────────

export async function ensureTodoLabel(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<void> {
  try {
    await octokit.rest.issues.getLabel({ owner, repo, name: TODO_LABEL });
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) {
      core.info(`Creating "${TODO_LABEL}" label...`);
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name: TODO_LABEL,
        color: 'FBCA04',
        description: 'Auto-generated TODO tracking issue',
      });
    } else {
      throw err;
    }
  }
}

// ── Issue fetching ─────────────────────────────────────────────────────────

export async function fetchExistingTodoIssues(
  octokit: Octokit,
  owner: string,
  repo: string,
): Promise<Array<{ number: number; title: string; body: string | null }>> {
  const issues: Array<{ number: number; title: string; body: string | null }> = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: TODO_LABEL,
      state: 'open',
      per_page: perPage,
      page,
      sort: 'created',
      direction: 'asc',
    });

    for (const issue of data) {
      if (issue.body && issue.body.includes(MANAGED_MARKER)) {
        issues.push({
          number: issue.number,
          title: issue.title,
          body: issue.body,
        });
      }
    }

    if (data.length < perPage) break;
    page++;
  }

  return issues;
}

// ── Title parsing ──────────────────────────────────────────────────────────

export function extractDescriptionFromTitle(title: string): string {
  if (title.startsWith(ISSUE_TITLE_PREFIX)) {
    return title.slice(ISSUE_TITLE_PREFIX.length).trim();
  }
  return title.trim();
}

// ── Issue body building ────────────────────────────────────────────────────

export function buildIssueBody(
  description: string,
  locations: TodoLocation[],
  repoUrl: string,
  defaultBranch: string,
): string {
  const locationRows = locations
    .map((loc) => {
      const fileLink = `[${loc.file}#L${loc.line}](${repoUrl}/blob/${defaultBranch}/${loc.file}#L${loc.line})`;
      const codeSnippet = loc.rawLine.trim().substring(0, 120);
      return `| ${fileLink} | ${loc.line} | \`${codeSnippet}\` |`;
    })
    .join('\n');

  return `${MANAGED_MARKER}

## TODO

> ${description}

### Locations

${LOCATIONS_START}

| File | Line | Code |
|------|------|------|
${locationRows}

${LOCATIONS_END}

---
*This issue is automatically managed by **doto-bot**. Closing this issue will trigger a PR to remove the TODO annotation(s) from the codebase.*
`;
}

// ── Issue body parsing ─────────────────────────────────────────────────────

export function parseLocationsFromBody(body: string): ParsedLocation[] {
  const locations: ParsedLocation[] = [];
  const startIdx = body.indexOf(LOCATIONS_START);
  const endIdx = body.indexOf(LOCATIONS_END);

  if (startIdx === -1 || endIdx === -1) return locations;

  const section = body.slice(startIdx + LOCATIONS_START.length, endIdx);
  const rowRegex = /\|\s*\[([^\]#]+)#L(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = rowRegex.exec(section)) !== null) {
    locations.push({
      file: match[1],
      line: parseInt(match[2], 10),
    });
  }

  return locations;
}

// ── Issue sync ─────────────────────────────────────────────────────────────

export async function syncIssues(
  octokit: Octokit,
  owner: string,
  repo: string,
  todoGroups: Map<string, TodoGroup>,
  defaultBranch: string,
): Promise<void> {
  const repoUrl = `https://github.com/${owner}/${repo}`;

  await ensureTodoLabel(octokit, owner, repo);

  const existingIssues = await fetchExistingTodoIssues(octokit, owner, repo);
  core.info(`Found ${existingIssues.length} existing doto-bot issues`);

  // Build a map keyed by normalized description
  const existingMap = new Map<
    string,
    { number: number; title: string; body: string | null }
  >();
  for (const issue of existingIssues) {
    const desc = extractDescriptionFromTitle(issue.title).toLowerCase().trim();
    existingMap.set(desc, issue);
  }

  const processedKeys = new Set<string>();

  // Create or update issues for current TODOs
  for (const [key, group] of todoGroups) {
    processedKeys.add(key);

    const title = `${ISSUE_TITLE_PREFIX}${group.description}`;
    const body = buildIssueBody(
      group.description,
      group.locations,
      repoUrl,
      defaultBranch,
    );

    if (existingMap.has(key)) {
      const existingIssue = existingMap.get(key)!;
      const existingLocations = parseLocationsFromBody(existingIssue.body || '');

      const locationsChanged =
        JSON.stringify(existingLocations) !==
        JSON.stringify(
          group.locations.map((l) => ({ file: l.file, line: l.line })),
        );

      if (locationsChanged) {
        core.info(`Updating issue #${existingIssue.number}: ${title}`);
        await octokit.rest.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          body,
        });
      } else {
        core.info(`Issue #${existingIssue.number} is up to date: ${title}`);
      }
    } else {
      core.info(`Creating new issue: ${title}`);
      await octokit.rest.issues.create({
        owner,
        repo,
        title,
        body,
        labels: [TODO_LABEL],
      });
    }
  }

  // Close issues whose TODOs are no longer in the codebase
  for (const [desc, issue] of existingMap) {
    if (!processedKeys.has(desc)) {
      core.info(`Closing stale issue #${issue.number}: ${issue.title}`);
      await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: issue.number,
        state: 'closed',
        state_reason: 'not_planned',
      });
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issue.number,
        body: '🤖 **doto-bot**: This TODO is no longer present in the codebase. Closing automatically.',
      });
    }
  }
}
