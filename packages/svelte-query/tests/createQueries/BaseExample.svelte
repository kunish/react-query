<script lang="ts">
  import { createQueries } from '../../src/index.js'
  import type { QueryClient } from '@tanstack/query-core'
  import type { QueriesOptions } from '../../src/index.js'

  export let options: {
    queries: [...QueriesOptions<any>]
  }
  export let queryClient: QueryClient

  const queries = createQueries(options, queryClient)
</script>

{#each $queries as query, index}
  <div>Status {index + 1}: {query.status}</div>
  <div>Data {index + 1}: {query.data}</div>
{/each}
