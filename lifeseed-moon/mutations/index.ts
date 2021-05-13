import { graphQLSchemaExtension } from '@keystone-next/keystone/schema';
import addToBasket from './addToBasket';
import checkout from './checkout';
import createLove from './createLove';
import createComment from './createComment';

const graphql = String.raw;
export const extendGraphqlSchema = graphQLSchemaExtension({
  typeDefs: graphql`
    type Mutation {
      addToBasket(presentId: ID): BasketItem
      createComment(presentId: ID, body: String): Comment
      createLove(presentId: ID): Love
      checkout(token: String!): Package
    }
  `,
  resolvers: {
    Mutation: {
      addToBasket,
      createComment,
      createLove,
      checkout,
    },
  },
});
