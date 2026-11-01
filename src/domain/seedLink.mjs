// Privileged memberships and provenance have separate consent-aware commands.
export const SEED_INTERBEING_RELATIONS=['collaborates_with','recognises','shares_resources_with','accepts_coin_of'];
export function seedLinkCommand(value) {
  if(!value || typeof value!=='object' || Array.isArray(value)
    || Object.keys(value).some(k=>!['action','from','rel','to'].includes(k))
    || !['link','unlink'].includes(value.action)
    || !['joined','guardian','observer','steward','grows_in','participant',...SEED_INTERBEING_RELATIONS].includes(value.rel)
    || (value.action==='link' && !['joined','guardian','grows_in','participant',...SEED_INTERBEING_RELATIONS].includes(value.rel)))return null;
  for(const key of ['from','to'])if(typeof value[key]!=='string' || !value[key] || value[key].length>(key==='from'?128:512)
    || /[\u0000-\u0020\u007f]/.test(value[key]))return null;
  if(SEED_INTERBEING_RELATIONS.includes(value.rel) && (value.from===value.to || value.to.length>128))return null;
  return {...value};
}
