import { useRouter } from 'next/dist/client/router';
import { Box } from '@material-ui/core';
import Products from '../../components/Products';
import Pagination from '../../components/Pagination';

export default function ProductsPage() {
  const { query } = useRouter();
  const page = parseInt(query.page);
  return (
    <Box style={{ paddingRight: '.7rem' }}>
      <Pagination page={page || 1} />
      <Products page={page || 1} />
      <Pagination page={page || 1} />
    </Box>
  );
}
