import express from 'express';
import { Webhooks } from '@octokit/webhooks';
import { scanRepository, groupTodosByDescription } from './scanner.js';
import { syncIssues } from './issues.js';
import { createResolutionPR } from './resolver.js';

const app = express();
app.use(express.json());

const webhooks = new Webhooks({ secret: process.env.WEBHOOK_SECRET || 'development' });

// Attach webhook handler to express
app.post('/webhooks', (req, res) => {
  webhooks.verifyAndReceive({
    id: req.headers['x-github-delivery'] as string,
    name: req.headers['x-github-event'] as string,
    payload: req.body,
    signature: req.headers['x-hub-signature-256'] as string,
  })
    .then(() => res.status(200).end())
    .catch(() => res.status(400).end());
});

// Example: handle push event
webhooks.on('push', async ({ payload }) => {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const defaultBranch = payload.repository.default_branch;
  // TODO: Clone repo, scan for TODOs, sync issues
  // Placeholder: console.log('Push event received for', owner, repo);
});

// Example: handle issues closed event
webhooks.on('issues.closed', async ({ payload }) => {
  const owner = payload.repository.owner.login;
  const repo = payload.repository.name;
  const issueNumber = payload.issue.number;
  // TODO: Create PR to resolve TODO
  // Placeholder: console.log('Issue closed:', issueNumber);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ImageBot App listening on port ${PORT}`);
});
