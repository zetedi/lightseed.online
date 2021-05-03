import PresentCreate from '../components/present/PresentCreate';
import PleaseSignIn from '../components/PleaseSignIn';

export default function PresentCreatePage() {
  return (
    <div>
      <PleaseSignIn>
        <PresentCreate />
      </PleaseSignIn>
    </div>
  );
}
