// lib/apollo-client.js
import { ApolloClient, InMemoryCache } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://base-mainnet.subgraph.x.superfluid.dev/', // Replace with your GraphQL API endpoint
  cache: new InMemoryCache(),
});

export default client;
