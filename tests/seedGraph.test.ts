import {expect,it,vi} from 'vitest';
import {seedGraphPage} from '../src/domain/seedGraph';
import {createIndependentGraphReads} from '../src/adapters/independent';
import type {SeedSession} from '../src/services/independent/session';
import {createGraphService} from '../src/services/graph';
const row={id:'alice__keeper__tree',from:'alice',rel:'keeper',to:'tree',createdAt:'2026-10-24T00:00:00.000Z'};
it('converts canonical link timestamps without trusting forged endpoint identities',()=>{
  const page=seedGraphPage({links:[row],next:null});
  expect(page.links[0].type).toBe('link');expect(page.links[0].createdAt?.toMillis()).toBe(Date.parse(row.createdAt));
  expect(page.links[0].createdAt?.toDate().toISOString()).toBe(row.createdAt);
  for(const item of [{...row,id:'other'},{...row,createdAt:'invalid'},{...row,rel:'unknown'}]) {
    expect(()=>seedGraphPage({links:[item],next:null})).toThrow('invalid_graph_link');
  }
  expect(()=>seedGraphPage({links:[],next:undefined})).toThrow('invalid_graph_page');
});
it('fetches every public graph page and keeps query values encoded',async()=>{
  const anonymous:SeedSession={status:'anonymous'};
  const publicRead=vi.fn().mockResolvedValueOnce({links:[row],next:row.id}).mockResolvedValueOnce({links:[],next:null});
  const read=vi.fn();const graph=createIndependentGraphReads({snapshot:()=>anonymous,read},publicRead);
  expect(await graph.linksTo('tree&uid=bob','keeper')).toHaveLength(1);
  expect(publicRead.mock.calls[0][0]).toBe('/v1/links?to=tree%26uid%3Dbob&rel=keeper&limit=100');
  expect(publicRead.mock.calls[1][0]).toContain('after=alice__keeper__tree');expect(read).not.toHaveBeenCalled();
  await expect(graph.secretLinksTo('tree')).rejects.toThrow('authentication_required');
});
it('uses the session for circle reads, refuses another account, and detects repeated cursors',async()=>{
  const identity:SeedSession={status:'authenticated',uid:'alice'};
  const read=vi.fn().mockResolvedValue({links:[row],next:null});
  const graph=createIndependentGraphReads({snapshot:()=>identity,read});
  await graph.secretLinksTo('tree');expect(read).toHaveBeenLastCalledWith('/v1/secret-circle-links?to=tree&limit=100');
  await graph.secretLinksFrom('alice');expect(read).toHaveBeenLastCalledWith('/v1/me/secret-links?limit=100');
  await expect(graph.secretLinksFrom('bob')).rejects.toThrow('forbidden');
  read.mockResolvedValue({links:[row],next:row.id});
  await expect(graph.linksByRel('keeper')).rejects.toThrow('invalid_graph_cursor');
});
it('discards the entire graph result when identity changes during pagination',async()=>{
  let identity:SeedSession={status:'authenticated',uid:'alice'};
  const read=vi.fn().mockResolvedValueOnce({links:[row],next:row.id}).mockImplementationOnce(async()=>{
    identity={status:'authenticated',uid:'bob'};return {links:[],next:null};
  });
  const graph=createIndependentGraphReads({snapshot:()=>identity,read});
  await expect(graph.linksByRel('keeper')).rejects.toThrow('session_changed');
});
it('composes the existing secret-tree graph service with independent reads',async()=>{
  const identity:SeedSession={status:'authenticated',uid:'alice'};
  const read=vi.fn().mockResolvedValueOnce({links:[row],next:null}).mockResolvedValueOnce({links:[row],next:null});
  const service=createGraphService(createIndependentGraphReads({snapshot:()=>identity,read}));
  const circle=await service.linksToTree({id:'tree',treeType:'SECRET'});
  expect(circle).toHaveLength(1);expect(circle[0].from).toBe('alice');
  expect(read).toHaveBeenCalledTimes(2);
});
