import { describe, expect, it, vi } from 'vitest';
import { applyToneToDraftAndRegenerate } from './applyToneToDraftAndRegenerate';

describe('applyToneToDraftAndRegenerate', () => {
  it('regenerates using screenshot text and toned draft', async () => {
    const adjustTone = vi.fn(async () => 'draft (professional)');
    const generateReply = vi.fn(async () => ({ reply: 'ok' }));

    const { adjustedDraft } = await applyToneToDraftAndRegenerate({
      screenshotText: 'incoming message',
      userDraft: 'my intent',
      selectedTone: 'professional',
      adjustTone,
      generateReply,
    });

    expect(adjustTone).toHaveBeenCalledWith('my intent', 'professional');
    expect(generateReply).toHaveBeenCalledWith('incoming message', 'draft (professional)', false, [], [], undefined);
    expect(adjustedDraft).toBe('draft (professional)');
  });
});

