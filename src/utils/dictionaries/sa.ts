import type { Dictionary } from './en';

// What sa says differently from English; every key it does not name reads English.
const sa = {
  forest: "अरण्यम्", pulses: "स्पन्दनानि", visions: "दृष्टयः", oracle: "दैववाणी", about: "विषये", explore: "अन्वेषणम्", 
  sign_in: "प्रविशतु", sign_out: "निर्गच्छतु", plant_lifetree: "रोपयतु", emit_pulse: "स्पन्दनम्", 
  be_mother_tree: "जीवनवृक्षं रोपयतु", loading: "आरोचयति...", my_trees: "वृक्षाः", profile: "परिचयः",
  pending_alignments: "लम्बित", quick_snap: "शीघ्रम्", validated: "प्रमाणित", 
  validate_action: "प्रमाणयतु", create_vision: "दृष्टिः", create_new_world: "नवं लोकं सृजतु",
  light_earth: "Living", intelligence: "बुद्धि:",
  communities: "समुदायाः", observatory: "वेधशाला", inspiration: "प्रेरणा",
} satisfies Partial<Dictionary>;

export default sa;
