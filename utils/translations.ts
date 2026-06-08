
export type Language = 'en' | 'es' | 'hu' | 'qu' | 'sa' | 'ja' | 'ar' | 'sw';

const baseKeys = {
  forest: "Forest", pulses: "Pulses", events: "Events", visions: "Visions", oracle: "Oracle", about: "About", explore: "Explore",
  sign_in: "Sign in", sign_out: "Sign out", emit_pulse: "Emit Pulse", plant_lifetree: "Plant Lifetree",
  create_vision: "New Vision", short_title: "Short Title", vision: "Vision", title: "Title", body: "Body",
  webpage: "Webpage Link", mint: "Mint Pulse", generate: "Generate", generate_image: "Gen Image",
  block: "BLOCK", loading: "Loading...", planting: "Planting...", minting: "Minting...", creating: "Creating...",
  map_view: "Map View", list_view: "List View", upload_photo: "Upload Photo", validated: "VALIDATED",
  unvalidated: "Unvalidated", validate_action: "Validate Tree", quick_snap: "Capture Change", back_forest: "Back",
  genesis: "Genesis Hash", steward: "Steward", location: "Location", tree_details: "Tree Details",
  profile: "Profile", my_trees: "My Trees", my_pulses: "My Pulses", my_alignments: "My Alignments",
  edit: "Edit", be_mother_tree: "Plant a Lifetree", guard_tree: "Guard Tree", alignments: "Alignments",
  pending_alignments: "Pending Alignments", no_pending_resonance: "No Resonance", search_placeholder: "Search...",
  guard: "Guard", nature: "Nature", lifetrees: "Lifetrees", no_trees_found: "None found", pending: "Pending",
  validated_trees: "Validated", observatory: "Observatory", inspiration: "Inspiration",
  growth: "Growth", loves: "Loves", oracle_greeting: "Greetings, Seeker. I am the Oracle. Shall I help you plant your Lifetree, or guide you on the path to realizing your Vision?", ask_oracle: "Ask the Oracle...",
  more: "More", send_invite: "Send Invite", invitations: "Invitations", invites_remaining: "Invites Remaining",
  copy_invite: "Copy Link", delete_account: "Delete Account", delete_confirm_title: "Delete Profile",
  delete_confirm_desc: "This will delete all your data forever.", delete_goodbye: "Goodbye.",
  ai_login_required: "Sign in to use AI.", subscription_title: "One email every 7 weeks.", subscribe_action: "Subscribe",
  subscribed_success: "Subscribed!", invalid_email: "Invalid email", latest_hash: "Latest Hash",
  daily_limit_image: "Daily Vision limit reached (3/3).", daily_limit_text: "Daily Oracle limit reached (21/21).",
  ether_quiet: "The ether is quiet, no resonance detected.", alignment_request: "Alignment Request",
  from_another_tree: "from another tree", accept_sync: "Accept Sync", no_visions_found: "No visions found.",
  propose_alignment: "Propose Alignment", alignment_with: "Aligning with", alignment_request_desc: "Send a resonance request.",
  internal_pulse: "Internal (Growth) Pulse", send_request: "Send Request", invite_sent: "Invite sent!",
  invite_email_placeholder: "Friend's email", invite_message_placeholder: "Message (optional)",
  cancel: "Cancel", back: "Back", subscription_failed: "Failed.", stand_for_trees: "Stand for the Trees",
  subscribe: "Subscribe", subscription_desc: "Email every 7 weeks.", guard_tree_action: "Guard Tree",
  create_new_world: "Create a New World",
  type_lifetree: "Lifetree", type_guarded: "Guarded", type_family: "Family",
  communities: "Communities", register_community: "Register Community",
  light_earth: "Light Earth", intelligence: "Intelligence"
};

export const translations: Record<Language, typeof baseKeys> = {
  en: baseKeys,
  es: { 
    ...baseKeys, forest: "Bosque", pulses: "Pulsos", visions: "Visiones", oracle: "Oráculo", about: "Acerca de", explore: "Explorar", 
    sign_in: "Iniciar sesión", sign_out: "Cerrar sesión", plant_lifetree: "Plantar Árbol", emit_pulse: "Emitir Pulso", 
    be_mother_tree: "Planta un Árbol de Vida", loading: "Cargando...", my_trees: "Mis Árboles", profile: "Perfil",
    pending_alignments: "Coincidencias Pendientes", quick_snap: "Capturar Cambio", validated: "VALIDADO", 
    validate_action: "Validar Árbol", create_vision: "Nueva Visión", create_new_world: "Crea un Nuevo Mundo",
    light_earth: "Tierra de Luz", intelligence: "Inteligencia",
    communities: "Comunidades", register_community: "Registrar Comunidad", observatory: "Observatorio", inspiration: "Inspiración"
  },
  hu: { 
    ...baseKeys, forest: "Erdő", pulses: "Pulzusok", visions: "Víziók", oracle: "Orákulum", about: "Rólunk", explore: "Felfedezés", 
    sign_in: "Belépés", sign_out: "Kilépés", plant_lifetree: "Ültetés", emit_pulse: "Pulzus", 
    be_mother_tree: "Ültess Életfát", loading: "Töltés...", my_trees: "Fáim", profile: "Profil",
    pending_alignments: "Függőben", quick_snap: "Gyors Fotó", validated: "HITELESÍTVE", 
    validate_action: "Hitelesítés", create_vision: "Új Vízió", create_new_world: "Teremts Új Világot",
    light_earth: "Fény Föld", intelligence: "Intelligencia",
    communities: "Közösségek", register_community: "Közösség Regisztrálása", observatory: "Obszervatórium", inspiration: "Inspiráció"
  },
  qu: { 
    ...baseKeys, forest: "Sach'a", pulses: "Sirkay", visions: "Musquy", oracle: "Willaq", about: "Kaymanta", explore: "Maskay", 
    sign_in: "Yaykuy", sign_out: "Lloqsiy", plant_lifetree: "Tarpuy", emit_pulse: "Sirkay", 
    be_mother_tree: "Mama Sach'a", loading: "Cargachkan...", my_trees: "Mallkikuna", profile: "Uyan",
    pending_alignments: "Suyaq", quick_snap: "Utqaylla", validated: "CHASKISQA", 
    validate_action: "Chaskiy", create_vision: "Musquy", create_new_world: "Musuq Pachata Ruray",
    light_earth: "K'anchay Allpa", intelligence: "Hamut'ay",
    communities: "Ayllukuna", observatory: "Qhawana", inspiration: "Samay"
  },
  sa: { 
    ...baseKeys, forest: "अरण्यम्", pulses: "स्पन्दनानि", visions: "दृष्टयः", oracle: "दैववाणी", about: "विषये", explore: "अन्वेषणम्", 
    sign_in: "प्रविशतु", sign_out: "निर्गच्छतु", plant_lifetree: "रोपयतु", emit_pulse: "स्पन्दनम्", 
    be_mother_tree: "जीवनवृक्षं रोपयतु", loading: "आरोचयति...", my_trees: "वृक्षाः", profile: "परिचयः",
    pending_alignments: "लम्बित", quick_snap: "शीघ्रम्", validated: "प्रमाणित", 
    validate_action: "प्रमाणयतु", create_vision: "दृष्टिः", create_new_world: "नवं लोकं सृजतु",
    light_earth: "ज्योतिर्भूमि:", intelligence: "बुद्धि:",
    communities: "समुदायाः", observatory: "वेधशाला", inspiration: "प्रेरणा"
  },
  ja: { 
    ...baseKeys, forest: "森", pulses: "パルス", visions: "ビジョン", oracle: "オラクル", about: "詳細", explore: "探索", 
    sign_in: "ログイン", sign_out: "ログアウト", plant_lifetree: "植樹", emit_pulse: "パルス", 
    be_mother_tree: "命の木を植える", loading: "読込中...", my_trees: "木", profile: "プロフ",
    pending_alignments: "保留中", quick_snap: "スナップ", validated: "認証済", 
    validate_action: "認証", create_vision: "ビジョン", create_new_world: "新しい世界を創造する",
    light_earth: "光の地球", intelligence: "知性",
    communities: "コミュニティ", observatory: "展望台", inspiration: "インスピレーション"
  },
  ar: { 
    ...baseKeys, forest: "الغابة", pulses: "نبضات", visions: "رؤى", oracle: "عراف", about: "عن", explore: "استكشاف", 
    sign_in: "دخول", sign_out: "خروج", plant_lifetree: "زرع", emit_pulse: "نبضة", 
    be_mother_tree: "ازرع شجرة حياة", loading: "تحميل...", my_trees: "أشجاري", profile: "ملف",
    pending_alignments: "معلقة", quick_snap: "لقطة", validated: "مصدق", 
    validate_action: "صدق", create_vision: "رؤية", create_new_world: "اخلق عالما جديدا",
    light_earth: "أرض النور", intelligence: "ذكاء",
    communities: "مجتمعات", observatory: "مرصد", inspiration: "إلهام"
  },
  sw: { 
    ...baseKeys, forest: "Msitu", pulses: "Mapigo", visions: "Maono", oracle: "Mtabiri", about: "Kuhusu", explore: "Chunguza", 
    sign_in: "Ingia", sign_out: "Toka", plant_lifetree: "Panda", emit_pulse: "Pigo", 
    be_mother_tree: "Panda Mti wa Uhai", loading: "Inapakia...", my_trees: "Miti yangu", profile: "Wasifu",
    pending_alignments: "Subiri", quick_snap: "Picha", validated: "IMETHIBITISHWA", 
    validate_action: "Thibitisha", create_vision: "Ono", create_new_world: "Unda Ulimwengu Mpya",
    light_earth: "Dunia ya Nuru", intelligence: "Akili",
    communities: "Jamii", observatory: "Kituo cha Uchunguzi", inspiration: "Uvuvio"
  }
};
