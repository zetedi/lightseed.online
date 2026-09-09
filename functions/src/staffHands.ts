// THE STAFF HANDS, server side — the switch read the way firestore.rules' staffHand reads it:
// config/staffHands, absent = lent. MIRRORS src/domain/staffHands.staffHandOn for the hands
// enforced in functions (door_grant). The record itself lives in src/domain/staffHands.
export const staffHandOn = (switches: Record<string, unknown> | null | undefined, id: string, defaultOn = true): boolean => {
    const v = switches?.[id];
    return typeof v === 'boolean' ? v : defaultOn;
};
