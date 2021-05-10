import PostCreate from '../components/post/PostCreate';
import SignInChecker from '../components/admin/SignInChecker';

export default function PostCreatePage() {
  return (
    <div>
      <SignInChecker>
        <PostCreate />
      </SignInChecker>
    </div>
  );
}
