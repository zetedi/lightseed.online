-- Community documents are public in the existing Firestore contract, including
-- invite/closed doors: the door controls joining, not reading the community.
-- This policy grants no membership or access to houses, users, or private seats.
CREATE POLICY communities_public_read ON public.communities FOR SELECT USING (true);
-- Runtime grants remain explicit in provisioning; no existing role is broadened.
