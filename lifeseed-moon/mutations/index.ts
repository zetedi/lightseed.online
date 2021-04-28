import { graphQLSchemaExtension } from '@keystone-next/keystone/schema';
import checkout from './checkout';
import addToBasket from './addToBasket';

const graphql = String.raw;
export const extendGraphqlSchema = graphQLSchemaExtension({
  typeDefs: graphql`
    type Mutation {
      addToBasket(presentId: ID): BasketItem
      checkout(token: String!): Package
    }
  `,
  resolvers: {
    Mutation: {
      addToBasket,
      checkout,
    },
  },
});
