import { describe, expect, it } from 'vitest';
import { sanitizeHumanReply } from './sanitizeHumanReply';

describe('sanitizeHumanReply', () => {
  it('normalizes common model punctuation and symbols', () => {
    const input = '“Hey”—quick update…\n• First → do this\n✓ Done\n';
    expect(sanitizeHumanReply(input)).toBe('"Hey"-quick update...\n- First -> do this\nDone');
  });

  it('removes invisible formatting characters', () => {
    const input = `Hello\u200B world\u202E`;
    expect(sanitizeHumanReply(input)).toBe('Hello world');
  });
});

