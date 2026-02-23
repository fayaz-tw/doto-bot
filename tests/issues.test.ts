import {
  buildIssueBody,
  parseLocationsFromBody,
  extractDescriptionFromTitle,
  MANAGED_MARKER,
  LOCATIONS_START,
  LOCATIONS_END,
} from '../src/issues';

describe('buildIssueBody', () => {
  test('generates a valid issue body with locations table', () => {
    const body = buildIssueBody(
      'Fix this bug',
      [
        { file: 'src/app.js', line: 42, rawLine: '// TODO: Fix this bug' },
        { file: 'src/utils.js', line: 18, rawLine: '# TODO: Fix this bug' },
      ],
      'https://github.com/owner/repo',
      'main',
    );

    expect(body).toContain(MANAGED_MARKER);
    expect(body).toContain(LOCATIONS_START);
    expect(body).toContain(LOCATIONS_END);
    expect(body).toContain('Fix this bug');
    expect(body).toContain('src/app.js#L42');
    expect(body).toContain('src/utils.js#L18');
    expect(body).toContain('doto-bot');
  });
});

describe('parseLocationsFromBody', () => {
  test('parses locations from a generated issue body', () => {
    const body = buildIssueBody(
      'Fix this bug',
      [
        { file: 'src/app.js', line: 42, rawLine: '// TODO: Fix this bug' },
        { file: 'src/utils.js', line: 18, rawLine: '# TODO: Fix this bug' },
      ],
      'https://github.com/owner/repo',
      'main',
    );

    const locations = parseLocationsFromBody(body);
    expect(locations).toHaveLength(2);
    expect(locations[0]).toEqual({ file: 'src/app.js', line: 42 });
    expect(locations[1]).toEqual({ file: 'src/utils.js', line: 18 });
  });

  test('returns empty array for body without markers', () => {
    const locations = parseLocationsFromBody('No markers here');
    expect(locations).toHaveLength(0);
  });
});

describe('extractDescriptionFromTitle', () => {
  test('strips the prefix', () => {
    expect(extractDescriptionFromTitle('TODO: Fix this bug')).toBe(
      'Fix this bug',
    );
  });

  test('handles title without prefix', () => {
    expect(extractDescriptionFromTitle('Some other title')).toBe(
      'Some other title',
    );
  });
});
