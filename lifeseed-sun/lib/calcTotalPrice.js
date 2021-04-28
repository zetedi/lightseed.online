export default function calcTotalPrice(basket) {
  return basket.reduce((tally, basketItem) => {
    if (!basketItem.present) return tally;
    return tally + basketItem.quantity * basketItem.present.price;
  }, 0);
}
