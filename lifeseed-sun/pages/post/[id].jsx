import PostView from '../../components/post/PostView';

export default function PostViewPage({ query }) {
  return <PostView id={query.id} />;
}
