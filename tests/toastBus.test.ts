import { describe, it, expect, vi } from 'vitest';
import { createToastBus, TOAST_HOLD_MS, TOAST_DWELL, dwellMs } from '../src/components/ui/toastBus';

// The toast bus's law: a word spoken to an empty room is held for the host, and spoken the
// moment the host arrives — if it is still fresh. The /b/ door's "not public" was dropped for
// every visitor because it was said while the shell still held its loader (no host mounted).

describe('a word spoken while no host listens', () => {
  it('is held, then spoken once the host attaches', () => {
    const bus = createToastBus();
    expect(bus.say({ message: 'being_link_not_public', kind: 'success' }, 1_000)).toBe('held');
    const heard = vi.fn();
    expect(bus.attach(heard, 1_500)).toEqual({ message: 'being_link_not_public', kind: 'success' });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(heard).toHaveBeenCalledWith({ message: 'being_link_not_public', kind: 'success' });
  });

  it('is spoken exactly once — a second host finds nothing held', () => {
    const bus = createToastBus();
    bus.say({ message: 'x', kind: 'error' }, 0);
    const first = vi.fn();
    bus.attach(first, 10);
    bus.detach(first);
    const second = vi.fn();
    expect(bus.attach(second, 20)).toBeNull();
    expect(second).not.toHaveBeenCalled();
  });

  it('only the last held word survives — the host shows one toast at a time', () => {
    const bus = createToastBus();
    bus.say({ message: 'first', kind: 'success' }, 0);
    bus.say({ message: 'second', kind: 'error' }, 1);
    const heard = vi.fn();
    expect(bus.attach(heard, 2)).toEqual({ message: 'second', kind: 'error' });
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('is let go when stale: a host arriving after the hold hears nothing', () => {
    const bus = createToastBus();
    bus.say({ message: 'old', kind: 'success' }, 0);
    const heard = vi.fn();
    expect(bus.attach(heard, TOAST_HOLD_MS + 1)).toBeNull();
    expect(heard).not.toHaveBeenCalled();
  });

  it('exactly at the hold it is still fresh', () => {
    const bus = createToastBus();
    bus.say({ message: 'edge', kind: 'success' }, 0);
    const heard = vi.fn();
    expect(bus.attach(heard, TOAST_HOLD_MS)).not.toBeNull();
  });
});

describe('a word spoken while a host listens', () => {
  it('is spoken at once and nothing is held', () => {
    const bus = createToastBus();
    const heard = vi.fn();
    bus.attach(heard, 0);
    expect(bus.say({ message: 'now', kind: 'success' }, 1)).toBe('spoken');
    expect(heard).toHaveBeenCalledWith({ message: 'now', kind: 'success' });
    bus.detach(heard);
    const next = vi.fn();
    expect(bus.attach(next, 2)).toBeNull();
  });

  it('a stale cleanup cannot silence the host that replaced it', () => {
    const bus = createToastBus();
    const old = vi.fn();
    const current = vi.fn();
    bus.attach(old, 0);
    bus.attach(current, 1);
    bus.detach(old); // the earlier mount's cleanup, arriving late
    expect(bus.listening).toBe(true);
    expect(bus.say({ message: 'still heard', kind: 'success' }, 2)).toBe('spoken');
    expect(current).toHaveBeenCalledTimes(1);
    expect(old).not.toHaveBeenCalled();
  });
});

describe('how long a word stays', () => {
  it('a short word keeps the base dwell of its kind; errors linger', () => {
    expect(dwellMs('Saved.', 'success')).toBe(TOAST_DWELL.base.success);
    expect(dwellMs('Could not save.', 'error')).toBe(TOAST_DWELL.base.error);
    expect(TOAST_DWELL.base.error).toBeGreaterThan(TOAST_DWELL.base.success);
  });

  it("the door's refusal sentence earns a breath per character beyond the short line", () => {
    const line = 'This link names a being that is not public. Sign in — it may open for you.';
    const expected = TOAST_DWELL.base.success + ([...line].length - TOAST_DWELL.freeChars) * TOAST_DWELL.perChar;
    expect(dwellMs(line, 'success')).toBe(expected);
    expect(expected).toBeGreaterThanOrEqual(5500);
  });

  it('never beyond the cap', () => {
    expect(dwellMs('x'.repeat(500), 'error')).toBe(TOAST_DWELL.max);
  });

  it('counts code points, not UTF-16 units', () => {
    expect(dwellMs('🌱'.repeat(TOAST_DWELL.freeChars + 6), 'success')).toBe(TOAST_DWELL.base.success + 6 * TOAST_DWELL.perChar);
  });
});
