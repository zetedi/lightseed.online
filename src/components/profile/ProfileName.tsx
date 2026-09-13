import React from 'react';
import { useSession } from '../../contexts/SessionContext';
import { renamePerson } from '../../services/firebase';
import { PERSON_NAME_MAX, normalizePersonName, personNameProblem } from '../../domain/personName';
import { EditableName } from '../ui/EditableName';

// THE PERSON'S NAME (ring 2026-09-07): the one in-place name editor (ui/EditableName) wearing
// the person's law and hand — the service moves auth profile and users document together, and
// the session wears the new name at once.
export const ProfileName: React.FC<{ name: string | null | undefined }> = ({ name }) => {
  const { setDisplayName } = useSession();
  return (
    <EditableName
      name={name}
      placeholderKey="name_ph"
      savedKey="name_saved"
      max={PERSON_NAME_MAX}
      normalize={normalizePersonName}
      problemOf={personNameProblem}
      onSave={async (next) => { await renamePerson(next); setDisplayName(next); }}
    />
  );
};
