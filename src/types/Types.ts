export interface NavItem {
  title: string
  href?: string
  disabled?: boolean
  external?: boolean
}

export type TreeKind = "mother" | "lifetree" | "guardian";

export type Tree = {
  id: string;
  name: string;
  kind: TreeKind;
  lat: number;
  lng: number;
  note?: string;
  color: string;
  guardianImage?: string;     // filename (mock)
  photoDataUrl?: string;      // uploaded photo
  fractalDataUrl?: string;    // generated PNG from canvas
};

export type Pulse = {
  id: string;
  text: string;
  attachedTreeId?: string; // if set, this pulse is locked and shows 🌳
};

export type Connection = {
  id: string;
  handle: string;
  sinceISO: string;
};
