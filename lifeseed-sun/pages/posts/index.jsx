import { useRouter } from 'next/dist/client/router';
import Link from 'next/link';
import { Box, IconButton } from '@material-ui/core';
import AddCircleIcon from '@material-ui/icons/AddCircle';
import { makeStyles } from '@material-ui/core/styles';
import Posts from '../../components/post/Posts';
import Pagination from '../../components/utils/Pagination';

const useStyles = makeStyles((theme) => ({
  ...theme.customTheme,
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    height: 'fit-content',
  },
}));

export default function PresentsPage() {
  const { query } = useRouter();
  const classes = useStyles();
  const page = parseInt(query.page);
  return (
    <Box style={{ paddingRight: '.7rem' }}>
      <Box className={classes.toolbar}>
        <Pagination page={page || 1} type="posts" />
        <Link href="/post">
          <IconButton>
            <AddCircleIcon className={classes.addIcon} />
          </IconButton>
        </Link>
      </Box>

      <Posts page={page || 1} />
      <Pagination page={page || 1} type="posts" />
    </Box>
  );
}
