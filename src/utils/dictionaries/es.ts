import type { Dictionary } from './en';

// What es says differently from English; every key it does not name reads English.
const es = {
  forest: "Bosque", pulses: "Pulsos", visions: "Visiones", oracle: "Oráculo", about: "Acerca de", explore: "Explorar", 
  sign_in: "Iniciar sesión", sign_out: "Cerrar sesión", plant_lifetree: "Plantar Árbol", emit_pulse: "Emitir Pulso", 
  be_mother_tree: "Planta un Árbol de Vida", loading: "Cargando...", my_trees: "Mis Árboles", profile: "Perfil",
  pending_alignments: "Coincidencias Pendientes", quick_snap: "Capturar Cambio", validated: "VALIDADO", 
  validate_action: "Validar Árbol", create_vision: "Nueva Visión", create_new_world: "Crea un Nuevo Mundo",
  light_earth: "Living", intelligence: "Inteligencia",
  communities: "Comunidades", register_community: "Registrar Comunidad", register: "Registrar", observatory: "Observatorio", inspiration: "Inspiración",
} satisfies Partial<Dictionary>;

export default es;
