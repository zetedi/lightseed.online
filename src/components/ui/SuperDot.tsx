// A small amber dot riding a control that is visible ONLY through staff privilege —
// "you can do this because of who you are, not because it is yours". Render it inside
// a `relative` control, next to the icon it qualifies.
export const SuperDot = () => (
  <span
    title="Visible to you as staff"
    className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-400 ring-1 ring-white"
    aria-hidden
  />
);
