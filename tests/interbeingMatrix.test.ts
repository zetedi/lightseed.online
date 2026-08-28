import { describe, expect, it } from 'vitest';
import {
  communityDomainAnchor,
  INTERBEING_RELATIONS,
  interbeingRelationDescKey,
  interbeingRelationKey,
  interbeingRelationState,
  type InterbeingRelation,
} from '../src/domain/interbeingMatrix';
import { translations } from '../src/utils/translations';

const relation = 'collaborates_with' satisfies InterbeingRelation;
const edge = (from: string, to: string): { from: string; to: string; rel: InterbeingRelation } =>
  ({ from, to, rel: relation });

describe('the Interbeing Matrix', () => {
  it('derives a proposal from one community attestation', () => {
    expect(interbeingRelationState('a', 'b', relation, [edge('a', 'b')])).toBe('proposed');
    expect(interbeingRelationState('b', 'a', relation, [edge('a', 'b')])).toBe('received');
  });

  it('derives reciprocity only when both communities attest in their own direction', () => {
    const links = [edge('a', 'b'), edge('b', 'a')];
    expect(interbeingRelationState('a', 'b', relation, links)).toBe('reciprocal');
    expect(interbeingRelationState('b', 'a', relation, links)).toBe('reciprocal');
  });

  it('does not confuse a different relationship type with acknowledgment', () => {
    expect(interbeingRelationState('a', 'b', 'recognises', [edge('a', 'b')])).toBe('none');
  });

  it('names the existing domain anchor honestly as self-declared', () => {
    expect(communityDomainAnchor({
      domain: 'https://WWW.Example.org:8080?view=matrix',
      domainAliases: ['https://WWW.Seed.Example.org:444/welcome#anchor'],
    })).toEqual({
      canonicalDomain: 'example.org',
      aliases: ['seed.example.org'],
      verification: 'self_declared',
    });
  });

  it('keeps relation words in every completed tongue, outside the domain', () => {
    for (const lang of ['en', 'ar', 'zh'] as const) {
      const dict = translations[lang] as Record<string, string>;
      for (const rel of INTERBEING_RELATIONS) {
        expect(dict[interbeingRelationKey(rel)], `${lang}: ${rel} label`).toBeTruthy();
        expect(dict[interbeingRelationDescKey(rel)], `${lang}: ${rel} description`).toBeTruthy();
      }
    }
  });
});
