import PresentCreate from '../components/present/PresentCreate';
import SignInChecker from '../components/admin/SignInChecker';

export default function PresentCreatePage() {
  return (
    <div>
      <SignInChecker>
        <PresentCreate />
      </SignInChecker>
    </div>
  );
}
