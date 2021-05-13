import gql from 'graphql-tag';

export const LOVE_MUTATION = gql`
  mutation LOVE_MUTATION($id: ID!) {
    love(presentId: $id) {
      id
    }
  }
`;

export const CREATE_PRESENT_MUTATION = gql`
  mutation CREATE_PRESENT_MUTATION(
    $type: String
    $name: String!
    $body: String!
    $creationTime: String!
    $price: Int
  ) {
    createPresent(
      data: {
        type: $type
        body: $body
        creationTime: $creationTime
        name: $name
        price: $price
        status: "AVAILABLE"
      }
    ) {
      id
      name
      body
    }
  }
`;

export const ALL_PRESENTS_QUERY = gql`
  query ALL_PRESENTS_QUERY($skip: Int = 0, $first: Int, $type: String) {
    allPresents(
      first: $first
      skip: $skip
      where: { type: $type }
      orderBy: "creationTime_DESC"
    ) {
      body
      comments {
        id
        creationTime
        body
        lifeseed {
          id
          lifetree {
            image
          }
        }
      }
      image
      price
      loves {
        id
        lifeseed {
          id
        }
      }
      creationTime
      id
      lifeseed {
        lifetree {
          image
        }
      }
      name
    }
  }
`;

export const DELETE_PRESENT_MUTATION = gql`
  mutation DELETE_PRESENT_MUTATION($id: ID!) {
    deletePresent(id: $id) {
      id
    }
  }
`;

export const SINGLE_PRESENT_QUERY = gql`
  query SINGLE_PRESENT_QUERY($id: ID!) {
    present: Present(where: { id: $id }) {
      body
      comments {
        id
        creationTime
        body
        lifeseed {
          id
        }
      }
      creationTime
      id
      image
      price
      lifeseed {
        lifetree {
          image
        }
      }
      loves {
        id
      }
      name
    }
  }
`;

export function update(cache, payload) {
  cache.evict(cache.identify(payload.data.deletePresent));
}
