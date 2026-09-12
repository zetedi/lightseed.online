import type { Dictionary } from './en';

// What qu says differently from English; every key it does not name reads English.
const qu = {
  forest: "Sach'a", pulses: "Sirkay", visions: "Musquy", oracle: "Willaq", about: "Kaymanta", explore: "Maskay", 
  sign_in: "Yaykuy", sign_out: "Lloqsiy", plant_lifetree: "Tarpuy", emit_pulse: "Sirkay", 
  be_mother_tree: "Mama Sach'a", loading: "Cargachkan...", my_trees: "Mallkikuna", profile: "Uyan",
  pending_alignments: "Suyaq", quick_snap: "Utqaylla", validated: "CHASKISQA", 
  validate_action: "Chaskiy", create_vision: "Musquy", create_new_world: "Musuq Pachata Ruray",
  light_earth: "Living", intelligence: "Hamut'ay",
  communities: "Ayllukuna", observatory: "Qhawana", inspiration: "Samay",
} satisfies Partial<Dictionary>;

export default qu;
