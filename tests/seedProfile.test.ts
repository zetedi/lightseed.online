import { describe, expect, it } from 'vitest';
import { seedProfileInput } from '../src/domain/seedProfile.mjs';
import { seedRequest } from '../src/domain/seedRequest.mjs';

describe('independent profile input', () => {
  it('accepts only appearance picture slots and local media paths, with explicit removal', () => {
    const picture={action:'set_picture',slot:'siteLogoUrl',path:'users/alice/logo.png'};
    expect(seedProfileInput(picture)).toEqual(picture);
    expect(seedProfileInput({...picture,slot:'siteHeroUrl',path:null})).not.toBeNull();
    for(const patch of [{slot:'publicKeyPem'},{path:'https://external.test/logo.png'},{path:undefined},{uid:'bob'},{path:'users/../logo.png'}]) {
      expect(seedProfileInput({...picture,...patch})).toBeNull();
    }
  });
  it('normalizes the shared person-name law and accepts no authority or identity fields', () => {
    expect(seedProfileInput({ displayName: '  Alice   Willow ' })).toEqual({ displayName: 'Alice Willow' });
    for (const value of [null, [], {}, { displayName: 42 }, { displayName: '' }, { displayName: 'x'.repeat(61) },
      { displayName: 'a\0b' }, { displayName: 'Alice', uid: 'bob' }, { displayName: 'Alice', lid: 'forged' },
      { displayName: 'Alice', publicKeyPem: 'key' }, { displayName: 'Alice', role: 'admin' }]) expect(seedProfileInput(value)).toBeNull();
  });
  it('requires a verified caller for profile reads and writes', () => {
    expect(seedRequest('POST', '/v1/me/profile', undefined)).toMatchObject({ status: 401 });
    expect(seedRequest('POST', '/v1/me/profile', 'verified', true)).toEqual({ kind: 'saveProfile' });
    expect(seedRequest('GET', '/v1/me/profile', 'verified', true)).toEqual({ kind: 'profile' });
    expect(seedRequest('POST', '/v1/links', 'verified', true)).toMatchObject({ status: 405 });
    expect(seedRequest('GET', '/v1/me/profile?uid=bob', 'verified', true)).toMatchObject({ status: 400 });
  });
});

import {seedPeopleQuery} from '../src/domain/seedProfile.mjs';
it('bounds public person lookup and treats name searches as data',()=>{
  expect(seedPeopleQuery(new URLSearchParams('q=Willow&limit=20'))).toMatchObject({kind:'people',query:'Willow',limit:20});
  expect(seedPeopleQuery(new URLSearchParams('id=alice'))).toMatchObject({id:'alice'});
  for(const query of ['id=a&q=b','q=','q=%00','limit=101','email=a','q=a&q=b','after='])expect(seedPeopleQuery(new URLSearchParams(query))).toBeNull();
});
