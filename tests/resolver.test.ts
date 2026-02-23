import { removeLineFromContent } from '../src/resolver';

describe('removeLineFromContent', () => {
  const content = `line 1
line 2
line 3
line 4
line 5`;

  test('removes the correct line', () => {
    const result = removeLineFromContent(content, 3);
    expect(result).toBe(`line 1
line 2
line 4
line 5`);
  });

  test('removes the first line', () => {
    const result = removeLineFromContent(content, 1);
    expect(result).toBe(`line 2
line 3
line 4
line 5`);
  });

  test('removes the last line', () => {
    const result = removeLineFromContent(content, 5);
    expect(result).toBe(`line 1
line 2
line 3
line 4`);
  });

  test('returns unchanged content for invalid line number', () => {
    expect(removeLineFromContent(content, 0)).toBe(content);
    expect(removeLineFromContent(content, 99)).toBe(content);
    expect(removeLineFromContent(content, -1)).toBe(content);
  });
});
