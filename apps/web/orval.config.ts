import { defineConfig } from 'orval';

export default defineConfig({
  ticketApi: {
    input: {
      target: '../../openapi.json',
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints',
      schemas: 'src/api/model',
      client: 'react-query',
      httpClient: 'axios',
      indexFiles: true,
      override: {
        mutator: {
          path: './src/lib/custom-instance.ts',
          name: 'customInstance',
        },
        query: {
          usePrefetch: true,
          useInvalidate: true,
          useSetQueryData: true,
          useGetQueryData: true,
          useSuspenseQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'page',
          shouldExportKeys: true,
          signal: true,
          mutationInvalidates: [
            {
              onMutations: [
                'ticketsControllerCreate',
                'ticketsControllerUpdate',
                'ticketsControllerAutoAssign',
                'ticketsControllerAddComment',
                'ticketsControllerRemove',
              ],
              invalidates: ['ticketsControllerFindAll'],
            },
            {
              onMutations: [
                'incidentBannersControllerCreate',
                'incidentBannersControllerUpdate',
                'incidentBannersControllerDelete',
              ],
              invalidates: [
                'incidentBannersControllerFindActive',
                'incidentBannersControllerFindAll',
              ],
            },
            {
              onMutations: [
                'cannedResponsesControllerCreate',
                'cannedResponsesControllerUpdate',
                'cannedResponsesControllerDelete',
              ],
              invalidates: ['cannedResponsesControllerFindAll'],
            },
            {
              onMutations: [
                'authControllerCreateInvite',
                'authControllerRevokeInvite',
              ],
              invalidates: ['authControllerListInvites'],
            },
            {
              onMutations: ['authControllerAdminCreateUser'],
              invalidates: ['authControllerGetAgents'],
            },
          ],
        },
      },
    },
  },
});
