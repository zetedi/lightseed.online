import PostView from '../../components/post/PostView';

export default function PresentViewPage({ query }) {
  return <PostView id={query.id} />;
}
