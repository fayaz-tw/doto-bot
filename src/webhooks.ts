import { Webhooks } from '@octokit/webhooks';

const webhooks = new Webhooks({ secret: process.env.WEBHOOK_SECRET || 'development' });

export default webhooks;
