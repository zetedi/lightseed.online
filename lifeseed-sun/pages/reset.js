import RequestReset from '../components/RequestReset';
import Reset from '../components/Reset';

export default function ResetPage({ query }) {
  if (!query?.token) {
    return <RequestReset />;
  }
  return <Reset token={query.token} />;
}
