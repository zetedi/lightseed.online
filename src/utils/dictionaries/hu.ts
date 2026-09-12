import type { Dictionary } from './en';

// What hu says differently from English; every key it does not name reads English.
const hu = {
  forest: "Erdő", pulses: "Pulzusok", visions: "Víziók", oracle: "Orákulum", about: "Rólunk", explore: "Felfedezés", 
  sign_in: "Belépés", sign_out: "Kilépés", plant_lifetree: "Ültetés", emit_pulse: "Pulzus", 
  be_mother_tree: "Ültess Életfát", loading: "Töltés...", my_trees: "Fáim", profile: "Profil",
  pending_alignments: "Függőben", quick_snap: "Gyors Fotó", validated: "HITELESÍTVE", 
  validate_action: "Hitelesítés", create_vision: "Új Vízió", create_new_world: "Teremts Új Világot",
  light_earth: "Living", intelligence: "Intelligencia",
  communities: "Közösségek", register_community: "Közösség Regisztrálása", register: "Regisztráció", observatory: "Obszervatórium", inspiration: "Inspiráció",
} satisfies Partial<Dictionary>;

export default hu;
