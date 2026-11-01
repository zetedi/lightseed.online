// Retry only an explicitly aborted database transaction, never an uncertain outcome.
export function seedTransactionRetry({code,attempt,aborted}) {
  return aborted===true && Number.isInteger(attempt) && attempt>=0 && attempt<2
    && ['40001','40P01'].includes(code);
}
