import CreatePresent from '../components/CreatePresent';
import PleaseSignIn from '../components/PleaseSignIn';

export default function SellPage() {
  return (
    <div>
      <PleaseSignIn>
        <CreatePresent />
      </PleaseSignIn>
    </div>
  );
}
