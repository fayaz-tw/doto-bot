# Doto Bot

A GitHub Action that automatically scans repositories for TODO comments and syncs them with GitHub Issues. When TODOs are found, corresponding issues are created or updated. When an issue is resolved, the action can create a PR to remove the TODO from the codebase.

## Features
- 🔍 Scans repository for TODO annotations in all code files
- 📝 Auto-creates GitHub Issues for each unique TODO
- 🔄 Updates existing issues when TODOs are modified
- 🗑️ Closes issues when TODOs are removed
- 🛠️ Creates PRs to remove TODOs when issues are closed
- ✅ Gracefully handles repositories with no TODOs
- 🚨 Provides detailed error messages for debugging

## Installation

Add this action to your GitHub workflow. Here's a minimal example:

### Basic Setup

Create `.github/workflows/doto-bot.yml`:

```yaml
name: Doto Bot

on:
  push:
    branches:
      - main
  issues:
    types: [closed]

jobs:
  doto-bot:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: fayaz.mohammad/doto-bot@v1
        with:
          mode: scan
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Configuration

### Inputs

| Input | Description | Default | Required |
|-------|-------------|---------|----------|
| `mode` | Action mode: `scan` or `resolve` | `scan` | No |
| `issue-number` | Issue number to resolve (required for `resolve` mode) | - | Only for `resolve` mode |

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_TOKEN` | GitHub token for API access | Yes |
| `GITHUB_WORKSPACE` | Repository workspace path | Defaults to current directory |

## Usage Modes

### Scan Mode
Scans the repository for TODO comments and syncs them with GitHub Issues.

```yaml
- uses: fayaz.mohammad/doto-bot@v1
  with:
    mode: scan
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**What it does:**
- Finds all TODO comments in the codebase
- Groups TODOs by description
- Creates new issues for new TODOs
- Updates existing issues if TODOs change
- Closes issues if TODOs are removed

### Resolve Mode
Creates a PR to remove a TODO when its corresponding issue is closed.

```yaml
- uses: fayaz.mohammad/doto-bot@v1
  with:
    mode: resolve
    issue-number: ${{ github.event.issue.number }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**What it does:**
- Finds TODO comments related to a closed issue
- Creates a pull request to remove those TODOs
- Links the PR to the original issue

## Example Workflows

### Automatic Scanning on Push

```yaml
name: Doto Bot - Scan TODOs

on:
  push:
    branches:
      - main

jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: fayaz.mohammad/doto-bot@v1
        with:
          mode: scan
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Create Resolution PRs on Issue Close

```yaml
name: Doto Bot - Resolve TODOs

on:
  issues:
    types: [closed]

jobs:
  resolve:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: fayaz.mohammad/doto-bot@v1
        with:
          mode: resolve
          issue-number: ${{ github.event.issue.number }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## TODO Comment Format

The action recognizes standard TODO comments:

```typescript
// TODO: Implement user authentication
// TODO(feature): Add dark mode support
// TODO(bug): Fix memory leak in parser
```

## Permissions Required

Your workflow needs these permissions:

```yaml
permissions:
  contents: read        # For scanning files
  issues: write         # For creating/updating issues
  pull-requests: write  # For creating resolution PRs
```

## Troubleshooting

### Action fails with "GITHUB_TOKEN environment variable is required"
Make sure you're passing `GITHUB_TOKEN` in the `env` section:
```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### No issues created even though TODOs exist
- Check that the action ran on the default branch
- Verify your TODO comments match the expected format
- Check action logs for detailed error messages

### "issue-number input is required for resolve mode"
When using `resolve` mode, you must provide:
```yaml
with:
  mode: resolve
  issue-number: ${{ github.event.issue.number }}
```

## Development

For local development:

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

## Project Structure

- `src/index.ts` - Main action entry point
- `src/scanner.ts` - TODO scanner logic
- `src/issues.ts` - GitHub Issues sync
- `src/resolver.ts` - TODO resolution PR creation
- `tests/` - Test suite
- `action.yml` - Action metadata

## License

MIT
