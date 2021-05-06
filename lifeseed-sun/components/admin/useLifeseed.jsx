import { gql, useQuery } from '@apollo/client';

export const CURRENT_LIFESEED_QUERY = gql`
  query {
    authenticatedItem {
      ... on Lifeseed {
        id
        email
        lifetree {
          id
        }
        name
        basket {
          id
          quantity
          present {
            id
            price
            name
            body
            photo {
              image {
                publicUrlTransformed
              }
            }
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
