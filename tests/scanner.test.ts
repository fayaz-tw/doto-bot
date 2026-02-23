import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  scanRepository,
  scanFile,
  groupTodosByDescription,
  cleanDescription,
  TODO_REGEX,
} from '../src/scanner';

// ── Helpers ────────────────────────────────────────────────────────────────

function createTempRepo(files: Record<string, string>): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doto-bot-test-'));
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(tmpDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return tmpDir;
}

function cleanupTempDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('TODO_REGEX', () => {
  test('matches "// TODO: description"', () => {
    const match = '// TODO: Fix this bug'.match(TODO_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('Fix this bug');
  });

  test('matches "# TODO: description"', () => {
    const match = '# TODO: Add validation'.match(TODO_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('Add validation');
  });

  test('matches "/* TODO: description */"', () => {
    const match = '/* TODO: Refactor later */'.match(TODO_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('Refactor later');
  });

  test('matches "<!-- TODO: description -->"', () => {
    const match = '<!-- TODO: Replace placeholder -->'.match(TODO_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('Replace placeholder');
  });

  test('matches "TODO(author): description"', () => {
    const match = '// TODO(john): Review this'.match(TODO_REGEX);
    expect(match).not.toBeNull();
    expect(match![1]).toContain('john');
  });

  test('does not match "TODOLIST"', () => {
    const match = 'const todolist = []'.match(TODO_REGEX);
    expect(match).toBeNull();
  });
});

describe('cleanDescription', () => {
  test('removes trailing */', () => {
    expect(cleanDescription('Fix this */  ')).toBe('Fix this');
  });

  test('removes trailing -->', () => {
    expect(cleanDescription('Replace placeholder -->')).toBe(
      'Replace placeholder',
    );
  });

  test('trims whitespace', () => {
    expect(cleanDescription('  Fix this  ')).toBe('Fix this');
  });
});

describe('scanFile', () => {
  test('finds TODOs in a JavaScript file', () => {
    const tmpDir = createTempRepo({
      'app.js': `
const x = 1;
// TODO: Fix this bug
function foo() {
  // TODO: Add error handling
  return x;
}
`,
    });

    const todos = scanFile(path.join(tmpDir, 'app.js'), tmpDir);
    expect(todos).toHaveLength(2);
    expect(todos[0].description).toBe('Fix this bug');
    expect(todos[0].line).toBe(3);
    expect(todos[0].file).toBe('app.js');
    expect(todos[1].description).toBe('Add error handling');
    expect(todos[1].line).toBe(5);

    cleanupTempDir(tmpDir);
  });

  test('finds TODOs in a Python file', () => {
    const tmpDir = createTempRepo({
      'main.py': `
# TODO: Add input validation
def process():
    pass
`,
    });

    const todos = scanFile(path.join(tmpDir, 'main.py'), tmpDir);
    expect(todos).toHaveLength(1);
    expect(todos[0].description).toBe('Add input validation');

    cleanupTempDir(tmpDir);
  });
});

describe('scanRepository', () => {
  test('scans multiple files', () => {
    const tmpDir = createTempRepo({
      'src/app.js': '// TODO: Implement auth\n',
      'src/utils.js': '// TODO: Add logging\n',
      'README.md': '# My Project\n',
    });

    const todos = scanRepository(tmpDir);
    expect(todos).toHaveLength(2);

    cleanupTempDir(tmpDir);
  });

  test('ignores node_modules', () => {
    const tmpDir = createTempRepo({
      'src/app.js': '// TODO: Fix\n',
      'node_modules/pkg/index.js': '// TODO: Should be ignored\n',
    });

    const todos = scanRepository(tmpDir);
    expect(todos).toHaveLength(1);
    expect(todos[0].file).toBe('src/app.js');

    cleanupTempDir(tmpDir);
  });

  test('ignores binary files', () => {
    const tmpDir = createTempRepo({
      'src/app.js': '// TODO: Fix\n',
      'image.png': 'binary content',
    });

    const todos = scanRepository(tmpDir);
    expect(todos).toHaveLength(1);

    cleanupTempDir(tmpDir);
  });
});

describe('groupTodosByDescription', () => {
  test('groups TODOs with same description', () => {
    const todos = [
      { file: 'a.js', line: 1, description: 'Fix this', rawLine: '// TODO: Fix this' },
      { file: 'b.js', line: 5, description: 'Fix this', rawLine: '// TODO: Fix this' },
      { file: 'c.js', line: 10, description: 'Other task', rawLine: '// TODO: Other task' },
    ];

    const groups = groupTodosByDescription(todos);
    expect(groups.size).toBe(2);
    expect(groups.get('fix this')!.locations).toHaveLength(2);
    expect(groups.get('other task')!.locations).toHaveLength(1);
  });

  test('is case-insensitive', () => {
    const todos = [
      { file: 'a.js', line: 1, description: 'fix THIS', rawLine: '// TODO: fix THIS' },
      { file: 'b.js', line: 5, description: 'Fix This', rawLine: '// TODO: Fix This' },
    ];

    const groups = groupTodosByDescription(todos);
    expect(groups.size).toBe(1);
    expect(groups.get('fix this')!.locations).toHaveLength(2);
  });
});
