# Doto Bot App

A GitHub App that scans repositories for TODO comments and syncs them with GitHub Issues.

## Features
- Listens to GitHub webhook events (push, issues closed, etc.)
- Scans repository for TODOs
- Creates, updates, or closes issues based on TODOs
- Can create PRs to resolve TODOs when issues are closed

## Usage

1. **Install dependencies:**
   ```sh
   pnpm install
   ```
2. **Run the app locally:**
   ```sh
   pnpm dev
   ```
3. **Expose your local server for GitHub webhooks:**
   Use [ngrok](https://ngrok.com/) or similar:
   ```sh
   ngrok http 3000
   ```
4. **Configure your GitHub App:**
   - Set the webhook URL to your public ngrok URL + `/webhooks`
   - Set the webhook secret as `WEBHOOK_SECRET` env variable

## Webhook Events Supported
- `push`: Triggers a scan and sync
- `issues.closed`: Triggers TODO resolution PR

## Project Structure
- `src/app.ts`: Express server and webhook entry point
- `src/webhooks.ts`: Webhook handler setup
- `src/scanner.ts`, `src/issues.ts`, `src/resolver.ts`: Core logic

---

**Note:** This is a refactor of the original GitHub Action to a GitHub App.
