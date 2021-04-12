import Image from 'next/image';
import Link from 'next/link';

function Lifecircle() {
  return (
    <Link href="/">
      <Image src="/static/lifeseed.svg" alt="lifeseed" width="64" height="64" />
    </Link>
  );
}

export default Lifecircle;
