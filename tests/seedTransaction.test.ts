import {expect,it} from 'vitest';
import {seedTransactionRetry} from '../src/domain/seedTransaction.mjs';
it('bounds retries to confirmed transaction aborts, excluding connection and application failures',()=>{
  for(const code of ['40001','40P01']) {
    expect(seedTransactionRetry({code,attempt:0,aborted:true})).toBe(true);
    expect(seedTransactionRetry({code,attempt:1,aborted:true})).toBe(true);
    expect(seedTransactionRetry({code,attempt:2,aborted:true})).toBe(false);
    expect(seedTransactionRetry({code,attempt:0,aborted:false})).toBe(false);
  }
  for(const code of ['08006','ECONNRESET','42501','LS018',undefined])expect(seedTransactionRetry({code,attempt:0,aborted:true})).toBe(false);
});
