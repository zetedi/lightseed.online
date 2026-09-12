import type { Dictionary } from './en';

// What ja says differently from English; every key it does not name reads English.
const ja = {
  forest: "森", pulses: "パルス", visions: "ビジョン", oracle: "オラクル", about: "詳細", explore: "探索", 
  sign_in: "ログイン", sign_out: "ログアウト", plant_lifetree: "植樹", emit_pulse: "パルス", 
  be_mother_tree: "命の木を植える", loading: "読込中...", my_trees: "木", profile: "プロフ",
  pending_alignments: "保留中", quick_snap: "スナップ", validated: "認証済", 
  validate_action: "認証", create_vision: "ビジョン", create_new_world: "新しい世界を創造する",
  light_earth: "Living", intelligence: "知性",
  communities: "コミュニティ", observatory: "展望台", inspiration: "インスピレーション",
} satisfies Partial<Dictionary>;

export default ja;
