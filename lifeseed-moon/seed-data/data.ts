export function randomTimeStamp(): string {
  // sometime in the last 30 days
  const timeStamp =
    Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 30);
  return new Date(timeStamp).toISOString();
}

export const presents = [
  {
    name: 'Light',
    body: 'Outdoor',
    status: 'AVAILABLE',
    price: 373737,
  },
];
