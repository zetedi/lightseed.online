import React from 'react';
import { useQuery } from '@apollo/client';
import dynamic from 'next/dynamic';
import gql from 'graphql-tag';
import SignInChecker from '../components/admin/SignInChecker';

export const ALL_LIFETREES_QUERY = gql`
  query {
    allLifeTrees {
      id
      name
      body
      image
      latitude
      longitude
    }
  }
`;

export default function MapPage() {
  const { data, error, loading } = useQuery(ALL_LIFETREES_QUERY);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  const Map = dynamic(() => import('../components/lifetree/LifeTreeMap'), {
    loading: () => <p>The lifeTree map is loading</p>,
    ssr: false, // prevents server-side render
  });

  return (
    <div>
      <SignInChecker>
        <Map lifeTrees={data.allLifeTrees} />
      </SignInChecker>
    </div>
  );
}
