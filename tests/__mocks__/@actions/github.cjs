// Manual mock for @actions/github (ESM-only in v9, can't be require()'d by Jest)
module.exports = {
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    ref: 'refs/heads/main',
    sha: 'abc123',
    payload: {},
    eventName: 'push',
    workflow: 'test',
    action: 'test',
    actor: 'test-user',
    job: 'test',
    runNumber: 1,
    runId: 1,
  },
  getOctokit: jest.fn(),
};
