// REORDERING BY HAND (ring 2026-10-05). A list a being arranges — the pictures of an event, a
// gallery's slides — is moved one item at a time: lift the item at `from`, set it down at `to`,
// everything between slides one step. Pure, so every strip of pictures moves the same way and the
// shell only draws. The FIRST item is load-bearing: a record's single `imageUrl` (its card face,
// its OG card) is `imageUrls[0]`, so moving a picture to the front changes what the world sees first.
//
// Plain contract: `moveItem` never loses or duplicates an item; an out-of-range or unchanged index
// returns the SAME array (so a React state setter sees no change and renders nothing).
export const moveItem = <T>(items: readonly T[], from: number, to: number): T[] => {
  const n = items.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return items as T[];
  const next = items.slice();
  const [lifted] = next.splice(from, 1);
  next.splice(to, 0, lifted);
  return next;
};

// Whether an item at `index` can move one step earlier / later — the arrows' enabled state.
export const canMoveEarlier = (index: number): boolean => index > 0;
export const canMoveLater = (index: number, length: number): boolean => index >= 0 && index < length - 1;
