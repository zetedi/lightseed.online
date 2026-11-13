// THE TREES REPOSITORY (ring 2026-11-03): one tree with the hand's standing at it, the forest page under the
// row policies, the tree's commands (keepership requests, pictures, resignation, the tree's own command), its
// invitations, and the person's own profile and picture.
import {run,rows,repositoryOf} from './statements.mjs';

export const treesRepository=withSession=>repositoryOf(withSession,{
  one:(c,id)=>rows(c,`SELECT id,doc,seed.can_edit_tree(id,doc) AS editable,seed.is_tree_keeper(id,doc) AS keeper, seed.is_staff() AS staff, EXISTS(SELECT 1 FROM public.links WHERE from_id=seed.uid() AND rel='steward' AND to_id=lifetrees.id) AS steward FROM public.lifetrees WHERE id=$1`,[id]).then(r=>r[0]??null),
  // Legacy unstamped trees remain reachable by ID or explicit public garden references, not anonymously
  // discoverable in an unscoped forest listing. Circle membership is enforced by RLS, so pagination follows authorized rows.
  page:(c,{domain,anchor,treeType,after,limit,garden,participating,editable})=>rows(c,`SELECT id,doc FROM public.lifetrees WHERE
    (doc ? 'visibility' OR doc->>'anchorUid'=seed.uid() OR seed.is_staff() OR $6::text IS NOT NULL OR $7::text IS NOT NULL OR $8::boolean)
    AND ($1::text IS NULL OR doc->>'domain'=$1) AND ($2::text IS NULL OR doc->>'anchorUid'=$2)
    AND ($3::text IS NULL OR coalesce(doc->>'treeType',CASE WHEN doc->>'isNature'='true' THEN 'GUARDED' ELSE 'LIFETREE' END)=$3)
    AND ($6::text IS NULL OR (coalesce(doc->>'treeType','') NOT IN ('BED','SECRET') AND EXISTS(
      SELECT 1 FROM public.links WHERE from_id=lifetrees.id AND rel='grows_in' AND to_id=$6)))
    AND ($7::text IS NULL OR (coalesce(doc->>'treeType','') NOT IN ('BED','SECRET') AND EXISTS(
      SELECT 1 FROM public.links WHERE from_id=lifetrees.id AND rel='participant' AND to_id=$7)))
    AND (NOT $8::boolean OR seed.can_edit_tree(id,doc))
    AND ($4::text IS NULL OR id>$4) ORDER BY id LIMIT $5`,[domain,anchor,treeType,after,limit,garden,participating,editable]),
  keeperRequest:(c,command,lid,token,lids)=>run(c,'SELECT seed.tree_keeper_request($1::jsonb,$2,$3,$4::text[]) AS result',[JSON.stringify(command),lid,token,lids]),
  pictures:(c,command)=>run(c,'SELECT seed.tree_pictures($1::jsonb) AS result',[JSON.stringify(command)]),
  resign:(c,command)=>run(c,'SELECT seed.tree_resign($1::jsonb) AS result',[JSON.stringify(command)]),
  command:(c,command,lids,nodeDomain)=>run(c,'SELECT seed.tree_command($1::jsonb,$2,$3,$4,$5) AS result',[JSON.stringify(command),...lids,nodeDomain]),
  invites:(c,id,tree,mine,after,limit)=>run(c,'SELECT seed.tree_invites($1,$2,$3,$4,$5) AS result',[id,tree,mine,after,limit]),
  inviteCommand:(c,command,token,lids)=>run(c,'SELECT seed.tree_invite_command($1::jsonb,$2,$3::text[]) AS result',[JSON.stringify(command),token,lids]),
  profilePicture:(c,input)=>c.query('SELECT seed.profile_picture($1::jsonb) AS profile',[JSON.stringify(input)]).then(r=>r.rows[0].profile),
  // The address the login carried (migration 056 record_login_email) rides beside the profile for the shell's own eyes.
  saveProfile:(c,displayName,lid)=>c.query('SELECT seed.save_profile($1, $2) AS profile, seed.my_email() AS email',[displayName,lid]).then(r=>r.rows[0]),
  myProfile:c=>c.query('SELECT seed.my_profile() AS profile, seed.my_email() AS email').then(r=>r.rows[0]),
});
