import { describe, expect, it } from 'vitest';
import { extensionForLanguage } from '../src/shared/language';

describe('language extensions', () => {
  it.each([
    ['python3', 'py'], ['C++', 'cpp'], ['Java 17', 'java'],
    ['JavaScript', 'js'], ['TypeScript', 'ts'], ['Rust', 'rs'],
    ['MySQL', 'sql'], ['Go', 'go'], ['Kotlin', 'kt'],
  ])('maps %s to .%s', (language, extension) => {
    expect(extensionForLanguage(language)).toBe(extension);
  });
  it('preserves source for unknown languages using txt', () => {
    expect(extensionForLanguage('Future Language')).toBe('txt');
  });
});
