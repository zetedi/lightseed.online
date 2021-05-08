import { gql, useQuery } from '@apollo/client';

export const CURRENT_LIFESEED_QUERY = gql`
  query {
    authenticatedItem {
      ... on Lifeseed {
        id
        email
        lifetree {
          id
          image
        }
        name
        basket {
          id
          quantity
          present {
            id
            image
            price
            name
            body
          }
        }
      }
    }
  }
`;

export function useLifeseed() {
  const { data } = useQuery(CURRENT_LIFESEED_QUERY);
  return data?.authenticatedItem;
}
