import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TodoEntry {
  file: string;
  line: number;
  description: string;
  rawLine: string;
}

export interface TodoLocation {
  file: string;
  line: number;
  rawLine: string;
}

export interface TodoGroup {
  description: string;
  locations: TodoLocation[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'vendor',
  '.next', '.nuxt', '__pycache__', '.venv', 'venv',
  'coverage', '.nyc_output', '.cache',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.mp3', '.mp4', '.avi', '.mov', '.webm',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.exe', '.dll', '.so', '.dylib', '.o', '.a',
  '.pyc', '.pyo', '.class', '.jar',
  '.lock', '.min.js', '.min.css',
]);

/**
 * Regex to match TODO annotations.
 * Supports: // TODO: ..., # TODO: ..., /* TODO: ... *​/, <!-- TODO: ... -->, etc.
 * Captures the description after "TODO:" or "TODO("
 */
export const TODO_REGEX = /\bTODO\s*[:(\s]\s*(.+)/i;

// ── Helpers ────────────────────────────────────────────────────────────────

function shouldIgnoreDir(dirName: string): boolean {
  return IGNORE_DIRS.has(dirName) || dirName.startsWith('.');
}

function shouldIgnoreFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

/**
 * Clean up the TODO description by trimming comment closers and whitespace.
 */
export function cleanDescription(raw: string): string {
  let desc = raw.trim();
  // Remove trailing comment closers: */, -->, *), etc.
  desc = desc.replace(/\s*\*\/\s*$/, '');
  desc = desc.replace(/\s*-->\s*$/, '');
  desc = desc.replace(/\s*\*\)\s*$/, '');
  // Remove trailing closing paren if TODO( was used
  desc = desc.replace(/\)\s*$/, '');
  desc = desc.trim();
  return desc;
}

// ── File scanning ──────────────────────────────────────────────────────────

/**
 * Scan a single file for TODO annotations.
 */
export function scanFile(filePath: string, repoRoot: string): TodoEntry[] {
  const todos: TodoEntry[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(TODO_REGEX);
      if (match) {
        const description = cleanDescription(match[1]);
        if (description.length > 0) {
          const relativePath = path.relative(repoRoot, filePath);
          todos.push({
            file: relativePath,
            line: i + 1, // 1-based
            description,
            rawLine: lines[i],
          });
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    core.warning(`Failed to read file ${filePath}: ${message}`);
  }

  return todos;
}

/**
 * Recursively walk a directory and collect all scannable file paths.
 */
function walkDir(dir: string): string[] {
  const files: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!shouldIgnoreDir(entry.name)) {
          files.push(...walkDir(fullPath));
        }
      } else if (entry.isFile()) {
        if (!shouldIgnoreFile(entry.name)) {
          files.push(fullPath);
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    core.warning(`Failed to read directory ${dir}: ${message}`);
  }

  return files;
}

// ── Repository scanning ────────────────────────────────────────────────────

/**
 * Scan the entire repository for TODO annotations.
 */
export function scanRepository(repoRoot: string): TodoEntry[] {
  core.info(`Scanning repository at: ${repoRoot}`);
  const allFiles = walkDir(repoRoot);
  core.info(`Found ${allFiles.length} files to scan`);

  const allTodos: TodoEntry[] = [];
  for (const filePath of allFiles) {
    const todos = scanFile(filePath, repoRoot);
    allTodos.push(...todos);
  }

  core.info(`Found ${allTodos.length} TODO annotations`);
  return allTodos;
}

/**
 * Group TODOs by their normalized description.
 * TODOs with the same description (case-insensitive, trimmed) are grouped together.
 */
export function groupTodosByDescription(
  todos: TodoEntry[],
): Map<string, TodoGroup> {
  const groups = new Map<string, TodoGroup>();

  for (const todo of todos) {
    const key = todo.description.toLowerCase().trim();
    if (!groups.has(key)) {
      groups.set(key, {
        description: todo.description,
        locations: [],
      });
    }
    groups.get(key)!.locations.push({
      file: todo.file,
      line: todo.line,
      rawLine: todo.rawLine,
    });
  }

  return groups;
}
