import {expect,it} from 'vitest';
import {seedTreeInviteCommand,seedTreeInviteQuery} from '../src/domain/seedTreeInvite.mjs';

it('separates open capabilities from named invitations and excludes authority claims',()=>{
  const mint={action:'mint',treeId:'tree',open:true,role:'keeper'};
  expect(seedTreeInviteCommand(mint)).toEqual(mint);
  expect(seedTreeInviteCommand({...mint,open:false,member:'bob'})).not.toBeNull();
  for(const extra of [{member:'bob'},{open:false},{open:'true'},{role:'admin'},{invitedByUserId:'alice'},{status:'accepted'},
    {message:'x'.repeat(1001)},{expiresAt:'2026-02-30T00:00:00.000Z'}])expect(seedTreeInviteCommand({...mint,...extra})).toBeNull();
  for(const action of ['claim','accept','decline','revoke']) {
    expect(seedTreeInviteCommand({action,id:'invite'})).toEqual({action,id:'invite'});
    expect(seedTreeInviteCommand({action,id:'invite',member:'other'})).toBeNull();
  }
});
it('keeps capability lookup separate from bounded lists and session-derived inboxes',()=>{
  expect(seedTreeInviteQuery(new URLSearchParams('id=token'))).toMatchObject({id:'token',kind:'treeInvites'});
  expect(seedTreeInviteQuery(new URLSearchParams('mine=true&limit=10'))).toMatchObject({mine:true,limit:10});
  for(const query of ['', 'id=a&tree=b','mine=false','id=a&after=b','tree=a&limit=101','mine=true&uid=other','tree=a&tree=b']) {
    expect(seedTreeInviteQuery(new URLSearchParams(query))).toBeNull();
  }
});
