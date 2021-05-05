import { useRouter } from 'next/dist/client/router';
import { Box } from '@material-ui/core';
import Presents from '../../components/present/Presents';
import Pagination from '../../components/utils/Pagination';

export default function PresentsPage() {
  const { query } = useRouter();
  const page = parseInt(query.page);
  return (
    <Box style={{ paddingRight: '.7rem' }}>
      <Pagination page={page || 1} />
      <Presents page={page || 1} />
      <Pagination page={page || 1} />
    </Box>
  );
}
