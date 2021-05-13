import { graphQLSchemaExtension } from '@keystone-next/keystone/schema';
import addToBasket from './addToBasket';
import checkout from './checkout';
import love from './love';
import createComment from './createComment';

const graphql = String.raw;
export const extendGraphqlSchema = graphQLSchemaExtension({
  typeDefs: graphql`
    type Mutation {
      addToBasket(presentId: ID): BasketItem
      createComment(presentId: ID, body: String): Comment
      love(presentId: ID): Love
      checkout(token: String!): Package
    }
  `,
  resolvers: {
    Mutation: {
      addToBasket,
      createComment,
      love,
      checkout,
    },
  },
});
