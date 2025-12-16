import { describe, expect, it } from 'vitest';
import { extractPersonName } from './extractPersonName';

describe('extractPersonName', () => {
  it('picks Instagram header above status lines', () => {
    const text = [
      'ryan.couronne',
      'Active 5h ago',
      'You accepted their message request',
      'Today 3:21 PM',
      'Hey are you free later?',
    ].join('\n');

    expect(extractPersonName(text)).toBe('ryan.couronne');
  });

  it('handles dot-separated Instagram header with active status', () => {
    const text = ['maria.ortiz · Active 1h ago', 'Active now', 'Message'].join('\n');
    expect(extractPersonName(text)).toBe('maria.ortiz');
  });

  it('picks Messenger header above active status', () => {
    const text = [
      'Jordan Lee',
      'Active now',
      'You matched on Facebook',
      'Yesterday',
      'Let me know!',
    ].join('\n');
    expect(extractPersonName(text)).toBe('Jordan Lee');
  });

  it('picks dot-separated Messenger header', () => {
    const text = ['Alex Kim · Active 2h ago', 'Messenger', 'Today at 3:10 PM'].join('\n');
    expect(extractPersonName(text)).toBe('Alex Kim');
  });

  it('returns Unknown when confidence is too low', () => {
    const text = ['hey how are you', 'thanks for sending'].join('\n');
    expect(extractPersonName(text)).toBe('Unknown');
  });
});
