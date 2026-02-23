# doto-bot 🤖

A GitHub Action that scans your repository for `TODO:` annotations in code, automatically creates and manages GitHub issues, and raises PRs to remove completed TODOs.

## Features

- **Auto-scan**: Detects `TODO:` annotations across your entire codebase on every push to the default branch.
- **Issue creation**: Creates a GitHub issue for each unique TODO, labeled with `todo`.
- **Deduplication**: If the same TODO description appears in multiple files, all locations are consolidated into a single issue.
- **Force-push safe**: On every push, the bot performs a full rescan — force pushes are handled correctly without creating duplicate issues.
- **Auto-close stale issues**: If a TODO is removed from code, its corresponding issue is automatically closed.
- **PR on issue close**: When you close a `todo`-labeled issue, the bot creates a Pull Request that removes the TODO line(s) from the codebase.

## How It Works

### Scan Mode (on push to default branch)

1. Scans all text files in the repository for lines matching `TODO:`, `TODO(`, etc.
2. Groups TODOs by their description text (case-insensitive dedup).
3. For each unique TODO:
   - If no issue exists → creates a new issue with the `todo` label.
   - If an issue already exists → updates it with current file locations.
4. Closes any bot-managed issues whose TODOs no longer exist in the code.

### Resolve Mode (on issue close)

1. When a `todo`-labeled issue is closed:
   - Reads the file locations from the issue body.
   - Creates a new branch and removes the TODO lines from each file.
   - Opens a Pull Request targeting the default branch.

## Setup

### 1. Add the workflow

Create `.github/workflows/doto-bot.yml` in your repository:

```yaml
name: Doto Bot

on:
  push:
    branches:
      - main          # adjust to your default branch
  issues:
    types:
      - closed

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  scan-todos:
    if: github.event_name == 'push'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Doto Bot - Scan TODOs
        uses: <owner>/<repo>@main    # or use a release tag
        with:
          mode: scan
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  resolve-todo:
    if: >
      github.event_name == 'issues' &&
      github.event.action == 'closed' &&
      contains(github.event.issue.labels.*.name, 'todo')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run Doto Bot - Resolve TODO
        uses: <owner>/<repo>@main    # or use a release tag
        with:
          mode: resolve
          issue-number: ${{ github.event.issue.number }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Supported TODO Formats

The scanner recognizes TODO annotations in any comment style:

```javascript
// TODO: Implement error handling
```

```python
# TODO: Add input validation
```

```html
<!-- TODO: Replace placeholder content -->
```

```css
/* TODO: Use CSS variables for theming */
```

```java
// TODO(author): Refactor this method
```

### 3. Issue Format

Each issue created by doto-bot includes:
- **Title**: `TODO: <description>`
- **Label**: `todo` (yellow)
- **Body**: A table of all file locations where that TODO appears, with direct links to the code.

Example:

> **TODO: Implement error handling**
>
> | File | Line | Code |
> |------|------|------|
> | [src/api.js#L42](link) | 42 | `// TODO: Implement error handling` |
> | [src/utils.js#L18](link) | 18 | `# TODO: Implement error handling` |

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `mode` | Yes | `scan` | `scan` to find TODOs, `resolve` to create removal PR |
| `issue-number` | No | — | Issue number to resolve (required for `resolve` mode) |

## Permissions

The action needs the following permissions:

```yaml
permissions:
  contents: write       # To create branches and commits
  issues: write         # To create/update/close issues
  pull-requests: write  # To create PRs
```

## Ignored Files and Directories

The scanner automatically skips:
- **Directories**: `node_modules`, `.git`, `dist`, `build`, `vendor`, `__pycache__`, `.venv`, `coverage`, and hidden directories.
- **Binary files**: Images, fonts, videos, archives, compiled files, and `.lock`/`.min.*` files.

## Development

```bash
# Install dependencies
pnpm install

# Build the action (bundles with @vercel/ncc)
pnpm run build

# Run tests
pnpm test
```

## License

MIT
