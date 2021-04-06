import React from 'react';
import dynamic from 'next/dynamic';

import PleaseSignIn from '../components/PleaseSignIn';

export default function Map() {
  const Map = React.useMemo(
    () =>
      dynamic(() => import('../components/LifeTreeMap'), {
        loading: () => <p>A map is loading</p>,
        ssr: false, // prevents server-side render
      }),
    []
  );

  return (
    <div>
      <PleaseSignIn>
        <Map />
      </PleaseSignIn>
    </div>
  );
}
