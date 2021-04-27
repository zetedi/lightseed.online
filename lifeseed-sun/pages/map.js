import React from 'react';
import { useMutation, useQuery } from '@apollo/client';
import dynamic from 'next/dynamic';
import gql from 'graphql-tag';
import PleaseSignIn from '../components/PleaseSignIn';

export const ALL_LIFETREES_QUERY = gql`
  query {
    allLifeTrees {
      id
      name
      description
      image
      latitude
      longitude
    }
  }
`;

export default function Map() {
  const { data, error, loading } = useQuery(ALL_LIFETREES_QUERY);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

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
        <Map lifeTrees={data.allLifeTrees} />
      </PleaseSignIn>
    </div>
  );
}
