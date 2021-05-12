import { graphQLSchemaExtension } from '@keystone-next/keystone/schema';
import checkout from './checkout';
import addToBasket from './addToBasket';
import createComment from './createComment';

const graphql = String.raw;
export const extendGraphqlSchema = graphQLSchemaExtension({
  typeDefs: graphql`
    type Mutation {
      addToBasket(presentId: ID): BasketItem
      createComment(presentId: ID, body: String): Comment
      checkout(token: String!): Package
    }
  `,
  resolvers: {
    Mutation: {
      addToBasket,
      createComment,
      checkout,
    },
  },
});
