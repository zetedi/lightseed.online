import {expect,it} from 'vitest';
import {seedPulseQuery} from '../src/domain/seedPulse.mjs';
import {seedRequest} from '../src/domain/seedRequest.mjs';
it('bounds pulse queries and preserves precise newest-first cursor positions',()=>{
  const cursor=JSON.stringify(['2026-10-28T01:00:00.123456Z','pulse']);
  expect(seedPulseQuery(new URLSearchParams({tree:'tree',type:'tree_growth',limit:'2',after:cursor}))).toMatchObject({kind:'pulses',tree:'tree',type:'tree_growth',limit:2,after:{moment:'2026-10-28T01:00:00.123456Z',id:'pulse'}});
  expect(seedRequest('GET','/v1/pulses?id=one',undefined)).toMatchObject({kind:'pulses',id:'one'});
  for(const query of ['id=','id=a&tree=b','tree=a&tree=b','limit=101','limit=0','author=%0A','uid=alice','after=bad','participant='])expect(seedPulseQuery(new URLSearchParams(query))).toBeNull();
  for(const moment of ['2026-02-30T00:00:00.000000Z','0000-01-01T00:00:00.000000Z','2026-10-28','infinity'])expect(seedPulseQuery(new URLSearchParams({after:JSON.stringify([moment,'id'])}))).toBeNull();
});
