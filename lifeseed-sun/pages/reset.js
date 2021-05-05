import RequestReset from '../components/admin/RequestReset';
import PasswordReset from '../components/admin/PasswordReset';

export default function ResetPage({ query }) {
  if (!query?.token) {
    return <RequestReset />;
  }
  return <PasswordReset token={query.token} />;
}
