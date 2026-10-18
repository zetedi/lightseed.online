import { describe, expect, it } from 'vitest';
import { aspectOf, fitInside } from '../src/domain/imageFit';

// A PICTURE SHOWN WHOLE (ring 2026-10-18): fitted inside a box, its aspect kept, never enlarged.

describe('fitInside', () => {
  it('shrinks a tall flyer to the box height and keeps its aspect', () => {
    expect(fitInside({ w: 1080, h: 1350 }, { w: 320, h: 320 })).toEqual({ w: 256, h: 320 });
  });
  it('shrinks a wide picture to the box width', () => {
    expect(fitInside({ w: 1600, h: 900 }, { w: 320, h: 320 })).toEqual({ w: 320, h: 180 });
  });
  it('never enlarges a small picture', () => {
    expect(fitInside({ w: 100, h: 50 }, { w: 320, h: 320 })).toEqual({ w: 100, h: 50 });
  });
  it('refuses a sizeless picture or box', () => {
    expect(fitInside({ w: 0, h: 10 }, { w: 320, h: 320 })).toBeNull();
    expect(fitInside({ w: 10, h: 10 }, { w: 0, h: 320 })).toBeNull();
    expect(fitInside({ w: NaN, h: 10 }, { w: 320, h: 320 })).toBeNull();
  });
});

describe('aspectOf', () => {
  it('reads width over height, or nothing', () => {
    expect(aspectOf({ w: 1080, h: 1350 })).toBeCloseTo(0.8);
    expect(aspectOf({ w: 0, h: 1350 })).toBeNull();
  });
});
