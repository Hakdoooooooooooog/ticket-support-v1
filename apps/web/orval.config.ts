import { defineConfig } from 'orval';

export default defineConfig({
  ticketApi: {
    input: {
      target: 'http://localhost:3001/api-json',
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints',
      schemas: 'src/api/model',
      client: 'react-query',
      httpClient: 'axios',
      baseUrl: 'http://localhost:3001',
    },
  },
});
