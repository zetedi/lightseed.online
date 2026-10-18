// A PICTURE SHOWN WHOLE (ring 2026-10-18). Every crop window and most seats cut a picture to
// their own frame; a flyer wants to be seen entire. This is the arithmetic of fitting a picture
// INSIDE a box without cutting it: the largest size that keeps its own aspect, never enlarged.
//
// Plain contract — GUARANTEED: the result keeps the picture's aspect (to rounding), fits both
// bounds, and is never larger than the picture itself; a picture with no size, or a box with
// none, yields nothing rather than a guess. Enforced by tests/imageFit.test.ts.

export interface Size { w: number; h: number }

export const fitInside = (picture: Size, box: Size): Size | null => {
  if (!(picture.w > 0 && picture.h > 0 && box.w > 0 && box.h > 0)) return null;
  const scale = Math.min(1, box.w / picture.w, box.h / picture.h);
  return { w: Math.max(1, Math.round(picture.w * scale)), h: Math.max(1, Math.round(picture.h * scale)) };
};

// The frame a picture asks for, as CSS reads it (`aspect-ratio`): width over height, or null.
export const aspectOf = (picture: Size): number | null =>
  picture.w > 0 && picture.h > 0 ? picture.w / picture.h : null;
