import type { Dictionary } from './en';

// What sw says differently from English; every key it does not name reads English.
const sw = {
  forest: "Msitu", pulses: "Mapigo", visions: "Maono", oracle: "Mtabiri", about: "Kuhusu", explore: "Chunguza", 
  sign_in: "Ingia", sign_out: "Toka", plant_lifetree: "Panda", emit_pulse: "Pigo", 
  be_mother_tree: "Panda Mti wa Uhai", loading: "Inapakia...", my_trees: "Miti yangu", profile: "Wasifu",
  pending_alignments: "Subiri", quick_snap: "Picha", validated: "IMETHIBITISHWA", 
  validate_action: "Thibitisha", create_vision: "Ono", create_new_world: "Unda Ulimwengu Mpya",
  light_earth: "Living", intelligence: "Akili",
  communities: "Jamii", observatory: "Kituo cha Uchunguzi", inspiration: "Uvuvio",
} satisfies Partial<Dictionary>;

export default sw;
