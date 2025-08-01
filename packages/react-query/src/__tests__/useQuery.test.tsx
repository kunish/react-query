import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import {
  mockVisibilityState,
  queryKey,
  sleep,
} from '@tanstack/query-test-utils'
import {
  QueryCache,
  QueryClient,
  dehydrate,
  hydrate,
  keepPreviousData,
  skipToken,
  useQuery,
} from '..'
import {
  Blink,
  mockOnlineManagerIsOnline,
  renderWithClient,
  setActTimeout,
} from './utils'
import type { DefinedUseQueryResult, QueryFunction, UseQueryResult } from '..'
import type { Mock } from 'vitest'

describe('useQuery', () => {
  let queryCache: QueryCache
  let queryClient: QueryClient

  beforeEach(() => {
    queryCache = new QueryCache()
    queryClient = new QueryClient({
      queryCache,
    })
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // See https://github.com/tannerlinsley/react-query/issues/105
  it('should allow to set default data value', async () => {
    const key = queryKey()

    function Page() {
      const { data = 'default' } = useQuery({
        queryKey: key,
        queryFn: () => sleep(10).then(() => 'test'),
      })

      return (
        <div>
          <h1>{data}</h1>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    expect(rendered.getByText('default')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('test')).toBeInTheDocument()
  })

  it('should return the correct states for a successful query', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    function Page() {
      const state = useQuery<string, Error>({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 'test'
        },
      })

      states.push(state)

      if (state.isPending) {
        return <span>pending</span>
      }

      if (state.isLoadingError) {
        return <span>{state.error.message}</span>
      }

      return <span>{state.data}</span>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('test')

    expect(states.length).toEqual(2)

    expect(states[0]).toEqual({
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isError: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: true,
      isPaused: false,
      isPending: true,
      isInitialLoading: true,
      isLoading: true,
      isLoadingError: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: false,
      isEnabled: true,
      refetch: expect.any(Function),
      status: 'pending',
      fetchStatus: 'fetching',
      promise: expect.any(Promise),
    })

    expect(states[1]).toEqual({
      data: 'test',
      dataUpdatedAt: expect.any(Number),
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isError: false,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isPaused: false,
      isPending: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: true,
      isEnabled: true,
      refetch: expect.any(Function),
      status: 'success',
      fetchStatus: 'idle',
      promise: expect.any(Promise),
    })

    expect(states[0]!.promise).toEqual(states[1]!.promise)
  })

  it('should return the correct states for an unsuccessful query', async () => {
    const key = queryKey()

    const states: Array<UseQueryResult> = []
    let index = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => Promise.reject(new Error(`rejected #${++index}`)),

        retry: 1,
        retryDelay: 1,
      })

      states.push(state)

      return (
        <div>
          <h1>Status: {state.status}</h1>
          <div>Failure Count: {state.failureCount}</div>
          <div>Failure Reason: {state.failureReason?.message}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(2)
    rendered.getByText('Status: error')

    expect(states[0]).toEqual({
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 0,
      failureReason: null,
      errorUpdateCount: 0,
      isError: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: true,
      isPaused: false,
      isPending: true,
      isInitialLoading: true,
      isLoading: true,
      isLoadingError: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: false,
      isEnabled: true,
      refetch: expect.any(Function),
      status: 'pending',
      fetchStatus: 'fetching',
      promise: expect.any(Promise),
    })

    expect(states[1]).toEqual({
      data: undefined,
      dataUpdatedAt: 0,
      error: null,
      errorUpdatedAt: 0,
      failureCount: 1,
      failureReason: new Error('rejected #1'),
      errorUpdateCount: 0,
      isError: false,
      isFetched: false,
      isFetchedAfterMount: false,
      isFetching: true,
      isPaused: false,
      isPending: true,
      isInitialLoading: true,
      isLoading: true,
      isLoadingError: false,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: false,
      isEnabled: true,
      refetch: expect.any(Function),
      status: 'pending',
      fetchStatus: 'fetching',
      promise: expect.any(Promise),
    })

    expect(states[2]).toEqual({
      data: undefined,
      dataUpdatedAt: 0,
      error: new Error('rejected #2'),
      errorUpdatedAt: expect.any(Number),
      failureCount: 2,
      failureReason: new Error('rejected #2'),
      errorUpdateCount: 1,
      isError: true,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isPaused: false,
      isPending: false,
      isInitialLoading: false,
      isLoading: false,
      isLoadingError: true,
      isPlaceholderData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: true,
      isSuccess: false,
      isEnabled: true,
      refetch: expect.any(Function),
      status: 'error',
      fetchStatus: 'idle',
      promise: expect.any(Promise),
    })

    expect(states[0]!.promise).toEqual(states[1]!.promise)
    expect(states[1]!.promise).toEqual(states[2]!.promise)
  })

  it('should set isFetchedAfterMount to true after a query has been fetched', async () => {
    const key = queryKey()

    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: () => 'prefetched',
    })

    function Page() {
      const result = useQuery({ queryKey: key, queryFn: () => 'new data' })

      return (
        <>
          <div>data: {result.data}</div>
          <div>isFetched: {result.isFetched ? 'true' : 'false'}</div>
          <div>
            isFetchedAfterMount: {result.isFetchedAfterMount ? 'true' : 'false'}
          </div>
        </>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    expect(rendered.getByText('data: prefetched')).toBeInTheDocument()
    expect(rendered.getByText('isFetched: true')).toBeInTheDocument()
    expect(rendered.getByText('isFetchedAfterMount: false')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('data: new data')).toBeInTheDocument()
    expect(rendered.getByText('isFetched: true')).toBeInTheDocument()
    expect(rendered.getByText('isFetchedAfterMount: true')).toBeInTheDocument()
  })

  it('should not cancel an ongoing fetch when refetch is called with cancelRefetch=false if we have data already', async () => {
    const key = queryKey()
    let fetchCount = 0

    function Page() {
      const { refetch } = useQuery({
        queryKey: key,
        queryFn: async () => {
          fetchCount++
          await sleep(10)
          return 'data'
        },
        enabled: false,
        initialData: 'initialData',
      })

      React.useEffect(() => {
        setActTimeout(() => {
          refetch()
        }, 5)
        setActTimeout(() => {
          refetch({ cancelRefetch: false })
        }, 5)
      }, [refetch])

      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(15)
    // first refetch only, second refetch is ignored
    expect(fetchCount).toBe(1)
  })

  it('should cancel an ongoing fetch when refetch is called (cancelRefetch=true) if we have data already', async () => {
    const key = queryKey()
    let fetchCount = 0

    function Page() {
      const { refetch } = useQuery({
        queryKey: key,
        queryFn: async () => {
          fetchCount++
          await sleep(10)
          return 'data'
        },
        enabled: false,
        initialData: 'initialData',
      })

      React.useEffect(() => {
        setActTimeout(() => {
          refetch()
        }, 5)
        setActTimeout(() => {
          refetch()
        }, 5)
      }, [refetch])

      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(15)
    // first refetch (gets cancelled) and second refetch
    expect(fetchCount).toBe(2)
  })

  it('should not cancel an ongoing fetch when refetch is called (cancelRefetch=true) if we do not have data yet', async () => {
    const key = queryKey()
    let fetchCount = 0

    function Page() {
      const { refetch } = useQuery({
        queryKey: key,
        queryFn: async () => {
          fetchCount++
          await sleep(10)
          return 'data'
        },
        enabled: false,
      })

      React.useEffect(() => {
        setActTimeout(() => {
          refetch()
        }, 5)
        setActTimeout(() => {
          refetch()
        }, 5)
      }, [refetch])

      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(15)
    // first refetch will not get cancelled, second one gets skipped
    expect(fetchCount).toBe(1)
  })

  it('should be able to watch a query without providing a query function', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    queryClient.setQueryDefaults(key, { queryFn: () => 'data' })

    function Page() {
      const state = useQuery<string>({ queryKey: key })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({ data: undefined })
    expect(states[1]).toMatchObject({ data: 'data' })
  })

  it('should pick up a query when re-mounting with gcTime 0', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    function Page() {
      const [toggle, setToggle] = React.useState(false)

      return (
        <div>
          <button onClick={() => setToggle(true)}>toggle</button>
          {toggle ? (
            <Component key="2" value="2" />
          ) : (
            <Component key="1" value="1" />
          )}
        </div>
      )
    }

    function Component({ value }: { value: string }) {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 'data: ' + value
        },

        gcTime: 0,
        notifyOnChangeProps: 'all',
      })
      states.push(state)
      return (
        <div>
          <div>{state.data}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1')

    fireEvent.click(rendered.getByRole('button', { name: /toggle/i }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 2')

    expect(states.length).toBe(4)
    // First load
    expect(states[0]).toMatchObject({
      isPending: true,
      isSuccess: false,
      isFetching: true,
    })
    // First success
    expect(states[1]).toMatchObject({
      isPending: false,
      isSuccess: true,
      isFetching: false,
    })
    // Switch, goes to fetching
    expect(states[2]).toMatchObject({
      isPending: false,
      isSuccess: true,
      isFetching: true,
    })
    // Second success
    expect(states[3]).toMatchObject({
      isPending: false,
      isSuccess: true,
      isFetching: false,
    })
  })

  it('should not get into an infinite loop when removing a query with gcTime 0 and rerendering', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    function Page() {
      const [, rerender] = React.useState({})

      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(5)
          return 'data'
        },

        gcTime: 0,
        notifyOnChangeProps: ['isPending', 'isSuccess', 'data'],
      })

      states.push(state)

      return (
        <>
          <div>{state.data}</div>

          <button
            onClick={() => {
              queryClient.removeQueries({ queryKey: key })
              rerender({})
            }}
          >
            remove
          </button>
        </>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('data')

    fireEvent.click(rendered.getByRole('button', { name: 'remove' }))

    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('data')

    expect(states.length).toBe(4)
    // First load
    expect(states[0]).toMatchObject({
      isPending: true,
      isSuccess: false,
      data: undefined,
    })
    // First success
    expect(states[1]).toMatchObject({
      isPending: false,
      isSuccess: true,
      data: 'data',
    })
    // Remove
    expect(states[2]).toMatchObject({
      isPending: true,
      isSuccess: false,
      data: undefined,
    })
    // Second success
    expect(states[3]).toMatchObject({
      isPending: false,
      isSuccess: true,
      data: 'data',
    })
  })

  it('should fetch when refetchOnMount is false and nothing has been fetched yet', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => 'test',
        refetchOnMount: false,
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({ data: undefined })
    expect(states[1]).toMatchObject({ data: 'test' })
  })

  it('should not fetch when refetchOnMount is false and data has been fetched already', () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    queryClient.setQueryData(key, 'prefetched')

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => 'test',
        refetchOnMount: false,
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    expect(states.length).toBe(1)
    expect(states[0]).toMatchObject({ data: 'prefetched' })
  })

  it('should be able to select a part of the data with select', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => ({ name: 'test' }),
        select: (data) => data.name,
      })
      states.push(state)

      return <div>{state.data}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('test')

    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({ data: undefined })
    expect(states[1]).toMatchObject({ data: 'test' })
  })

  it('should be able to select a part of the data with select in object syntax', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => ({ name: 'test' }),
        select: (data) => data.name,
      })
      states.push(state)

      return <div>{state.data}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('test')

    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({ data: undefined })
    expect(states[1]).toMatchObject({ data: 'test' })
  })

  it('should throw an error when a selector throws', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []
    const error = new Error('Select Error')

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => ({ name: 'test' }),
        select: () => {
          throw error
        },
      })
      states.push(state)

      return <div>{state.status}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('error')

    expect(states.length).toBe(2)

    expect(states[0]).toMatchObject({ status: 'pending', data: undefined })
    expect(states[1]).toMatchObject({ status: 'error', error })
  })

  it('should not re-run a stable select when it re-renders if selector throws an error', async () => {
    const key = queryKey()
    const error = new Error('Select Error')
    let runs = 0

    function Page() {
      const [, rerender] = React.useReducer(() => ({}), {})
      const state = useQuery<string, Error>({
        queryKey: key,
        queryFn: () => (runs === 0 ? 'test' : 'test2'),

        select: React.useCallback(() => {
          runs++
          throw error
        }, []),
      })
      return (
        <div>
          <div>error: {state.error?.message}</div>
          <button onClick={rerender}>rerender</button>
          <button onClick={() => state.refetch()}>refetch</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('error: Select Error')
    expect(runs).toEqual(1)
    fireEvent.click(rendered.getByRole('button', { name: 'rerender' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(runs).toEqual(1)
    fireEvent.click(rendered.getByRole('button', { name: 'refetch' }))
    await vi.advanceTimersByTimeAsync(0)
    expect(runs).toEqual(2)
  })

  it('should track properties and only re-render when a tracked property changes', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          count++
          return 'test' + count
        },
      })

      states.push(state)

      return (
        <div>
          <h1>{state.data ?? null}</h1>
          <button onClick={() => state.refetch()}>refetch</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('test1')

    fireEvent.click(rendered.getByRole('button', { name: /refetch/i }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('test2')

    expect(states.length).toBe(3)
    expect(states[0]).toMatchObject({ data: undefined })
    expect(states[1]).toMatchObject({ data: 'test1' })
    expect(states[2]).toMatchObject({ data: 'test2' })
  })

  it('should always re-render if we are tracking props but not using any', async () => {
    const key = queryKey()
    let renderCount = 0
    const states: Array<UseQueryResult<string>> = []

    function Page() {
      const state = useQuery({ queryKey: key, queryFn: () => 'test' })

      states.push(state)

      React.useEffect(() => {
        renderCount++
      }, [state])

      return (
        <div>
          <h1>hello</h1>
        </div>
      )
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(renderCount).toBe(2)
    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({ data: undefined })
    expect(states[1]).toMatchObject({ data: 'test' })
  })

  it('should be able to remove a query', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    let count = 0

    function Page() {
      const [, rerender] = React.useState({})
      const state = useQuery({
        queryKey: key,
        queryFn: () => ++count,
        notifyOnChangeProps: 'all',
      })

      states.push(state)

      return (
        <div>
          <button onClick={() => queryClient.removeQueries({ queryKey: key })}>
            remove
          </button>
          <button onClick={() => rerender({})}>rerender</button>
          data: {state.data ?? 'null'}
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('data: 1')
    fireEvent.click(rendered.getByRole('button', { name: /remove/i }))

    await vi.advanceTimersByTimeAsync(0)
    fireEvent.click(rendered.getByRole('button', { name: /rerender/i }))
    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('data: 2')

    expect(states.length).toBe(4)
    // Initial
    expect(states[0]).toMatchObject({ status: 'pending', data: undefined })
    // Fetched
    expect(states[1]).toMatchObject({ status: 'success', data: 1 })
    // Remove + Hook state update, batched
    expect(states[2]).toMatchObject({ status: 'pending', data: undefined })
    // Fetched
    expect(states[3]).toMatchObject({ status: 'success', data: 2 })
  })

  it('should create a new query when refetching a removed query', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return ++count
        },
        notifyOnChangeProps: 'all',
      })

      states.push(state)

      const { refetch } = state

      return (
        <div>
          <button onClick={() => queryClient.removeQueries({ queryKey: key })}>
            remove
          </button>
          <button onClick={() => refetch()}>refetch</button>
          data: {state.data ?? 'null'}
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1')
    fireEvent.click(rendered.getByRole('button', { name: /remove/i }))
    fireEvent.click(rendered.getByRole('button', { name: /refetch/i }))
    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 2')

    expect(states.length).toBe(4)
    // Initial
    expect(states[0]).toMatchObject({ data: undefined, dataUpdatedAt: 0 })
    // Fetched
    expect(states[1]).toMatchObject({ data: 1 })
    // Switch
    expect(states[2]).toMatchObject({ data: undefined, dataUpdatedAt: 0 })
    // Fetched
    expect(states[3]).toMatchObject({ data: 2 })
  })

  it('should share equal data structures between query results', async () => {
    const key = queryKey()

    const result1 = [
      { id: '1', done: false },
      { id: '2', done: false },
    ]

    const result2 = [
      { id: '1', done: false },
      { id: '2', done: true },
    ]

    const states: Array<UseQueryResult<typeof result1>> = []

    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          count++
          return count === 1 ? result1 : result2
        },
        notifyOnChangeProps: 'all',
      })

      states.push(state)

      const { refetch } = state

      return (
        <div>
          <button onClick={() => refetch()}>refetch</button>
          data: {String(state.data?.[1]?.done)}
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: false')
    fireEvent.click(rendered.getByRole('button', { name: /refetch/i }))
    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: true')

    expect(states.length).toBe(4)

    const todos = states[2]?.data
    const todo1 = todos?.[0]
    const todo2 = todos?.[1]

    const newTodos = states[3]?.data
    const newTodo1 = newTodos?.[0]
    const newTodo2 = newTodos?.[1]

    expect(todos).toEqual(result1)
    expect(newTodos).toEqual(result2)
    expect(newTodos).not.toBe(todos)
    expect(newTodo1).toBe(todo1)
    expect(newTodo2).not.toBe(todo2)

    return null
  })

  it('should use query function from hook when the existing query does not have a query function', async () => {
    const key = queryKey()

    queryClient.setQueryData(key, 'set')

    function Page() {
      const result = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 'fetched'
        },

        initialData: 'initial',
        staleTime: Infinity,
      })

      return (
        <div>
          <div>isFetching: {result.isFetching}</div>
          <button onClick={() => queryClient.refetchQueries({ queryKey: key })}>
            refetch
          </button>
          data: {result.data}
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('data: set')).toBeInTheDocument()
    fireEvent.click(rendered.getByRole('button', { name: /refetch/i }))
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('data: fetched')).toBeInTheDocument()
  })

  it('should update query stale state and refetch when invalidated with invalidateQueries', async () => {
    const key = queryKey()
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          count++
          return count
        },
        staleTime: Infinity,
      })

      return (
        <div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: key })}
          >
            invalidate
          </button>
          data: {state.data}, isStale: {String(state.isStale)}, isFetching:{' '}
          {String(state.isFetching)}
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    expect(
      rendered.getByText('data: 1, isStale: false, isFetching: false'),
    ).toBeInTheDocument()
    fireEvent.click(rendered.getByRole('button', { name: /invalidate/i }))
    await vi.advanceTimersByTimeAsync(0)
    expect(
      rendered.getByText('data: 1, isStale: true, isFetching: true'),
    ).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(11)
    expect(
      rendered.getByText('data: 2, isStale: false, isFetching: false'),
    ).toBeInTheDocument()
  })

  it('should not update disabled query when refetching with refetchQueries', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          count++
          return count
        },
        enabled: false,
      })

      states.push(state)

      React.useEffect(() => {
        setActTimeout(() => {
          queryClient.refetchQueries({ queryKey: key })
        }, 20)
      }, [])

      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(31)

    expect(states.length).toBe(1)
    expect(states[0]).toMatchObject({
      data: undefined,
      isFetching: false,
      isSuccess: false,
      isStale: false,
    })
  })

  it('should not refetch disabled query when invalidated with invalidateQueries', () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          count++
          return count
        },
        enabled: false,
      })

      states.push(state)

      React.useEffect(() => {
        setActTimeout(() => {
          queryClient.invalidateQueries({ queryKey: key })
        }, 10)
      }, [])

      return null
    }

    renderWithClient(queryClient, <Page />)

    expect(states.length).toBe(1)
    expect(states[0]).toMatchObject({
      data: undefined,
      isFetching: false,
      isSuccess: false,
      isStale: false,
    })
  })

  it('should not fetch when switching to a disabled query', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []

    function Page() {
      const [count, setCount] = React.useState(0)

      const state = useQuery({
        queryKey: [key, count],
        queryFn: async () => {
          await sleep(5)
          return count
        },
        enabled: count === 0,
      })

      states.push(state)

      return (
        <div>
          <button onClick={() => setCount(1)}>increment</button>
          <div>data: {state.data ?? 'undefined'}</div>
          <div>count: {count}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('data: 0')

    fireEvent.click(rendered.getByRole('button', { name: /increment/i }))

    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('count: 1')
    rendered.getByText('data: undefined')

    expect(states.length).toBe(3)

    // Fetch query
    expect(states[0]).toMatchObject({
      data: undefined,
      isFetching: true,
      isSuccess: false,
    })
    // Fetched query
    expect(states[1]).toMatchObject({
      data: 0,
      isFetching: false,
      isSuccess: true,
    })
    // Switch to disabled query
    expect(states[2]).toMatchObject({
      data: undefined,
      isFetching: false,
      isSuccess: false,
    })
  })

  it('should keep the previous data when placeholderData is set', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []

    function Page() {
      const [count, setCount] = React.useState(0)

      const state = useQuery({
        queryKey: [key, count],
        queryFn: async () => {
          await sleep(10)
          return count
        },
        placeholderData: keepPreviousData,
      })

      states.push(state)

      return (
        <div>
          <div>data: {state.data}</div>
          <button onClick={() => setCount(1)}>setCount</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 0')

    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1')

    // Initial
    expect(states[0]).toMatchObject({
      data: undefined,
      isFetching: true,
      isSuccess: false,
      isPlaceholderData: false,
    })
    // Fetched
    expect(states[1]).toMatchObject({
      data: 0,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
    // Set state
    expect(states[2]).toMatchObject({
      data: 0,
      isFetching: true,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // New data
    expect(states[3]).toMatchObject({
      data: 1,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
  })

  it('should keep the previous data when placeholderData is set and select fn transform is used', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []

    function Page() {
      const [count, setCount] = React.useState(0)

      const state = useQuery({
        queryKey: [key, count],
        queryFn: async () => {
          await sleep(10)
          return {
            count,
          }
        },
        select(data) {
          return data.count
        },
        placeholderData: keepPreviousData,
      })

      states.push(state)

      return (
        <div>
          <div>data: {state.data}</div>
          <button onClick={() => setCount(1)}>setCount</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 0')

    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1')

    // Initial
    expect(states[0]).toMatchObject({
      data: undefined,
      isFetching: true,
      isSuccess: false,
      isPlaceholderData: false,
    })
    // Fetched
    expect(states[1]).toMatchObject({
      data: 0,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
    // Set state
    expect(states[2]).toMatchObject({
      data: 0,
      isFetching: true,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // New data
    expect(states[3]).toMatchObject({
      data: 1,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
  })

  it('should keep the previous queryKey (from prevQuery) between multiple pending queries when placeholderData is set and select fn transform is used', async () => {
    const keys: Array<ReadonlyArray<unknown> | null> = []
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []

    function Page() {
      const [count, setCount] = React.useState(0)

      const state = useQuery({
        queryKey: [key, count],
        queryFn: async () => {
          await sleep(10)
          return {
            count,
          }
        },
        select(data) {
          return data.count
        },
        placeholderData: (prevData, prevQuery) => {
          if (prevQuery) {
            keys.push(prevQuery.queryKey)
          }
          return prevData
        },
      })

      states.push(state)

      return (
        <div>
          <div>data: {state.data}</div>
          <button onClick={() => setCount((prev) => prev + 1)}>setCount</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 0')

    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))
    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))
    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 3')

    const allPreviousKeysAreTheFirstQueryKey = keys.every(
      (k) => JSON.stringify(k) === JSON.stringify([key, 0]),
    )

    expect(allPreviousKeysAreTheFirstQueryKey).toBe(true)
  })

  it('should show placeholderData between multiple pending queries when select fn transform is used', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []

    function Page() {
      const [count, setCount] = React.useState(0)

      const state = useQuery({
        queryKey: [key, count],
        queryFn: async () => {
          await sleep(10)
          return {
            count,
          }
        },
        select(data) {
          return data.count
        },
        placeholderData: keepPreviousData,
      })

      states.push(state)

      return (
        <div>
          <div>data: {state.data}</div>
          <button onClick={() => setCount((prev) => prev + 1)}>setCount</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 0')

    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))
    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))
    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 3')
    // Initial
    expect(states[0]).toMatchObject({
      data: undefined,
      isFetching: true,
      isSuccess: false,
      isPlaceholderData: false,
    })
    // Fetched
    expect(states[1]).toMatchObject({
      data: 0,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
    // Set state -> count = 1
    expect(states[2]).toMatchObject({
      data: 0,
      isFetching: true,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // Set state -> count = 2
    expect(states[3]).toMatchObject({
      data: 0,
      isFetching: true,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // Set state -> count = 3
    expect(states[4]).toMatchObject({
      data: 0,
      isFetching: true,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // New data
    expect(states[5]).toMatchObject({
      data: 3,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
  })

  it('should transition to error state when placeholderData is set', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []

    function Page({ count }: { count: number }) {
      const state = useQuery<number, Error>({
        queryKey: [key, count],
        queryFn: async () => {
          await sleep(10)
          if (count === 2) {
            throw new Error('Error test')
          }
          return Promise.resolve(count)
        },
        retry: false,
        placeholderData: keepPreviousData,
      })

      states.push(state)

      return (
        <div>
          <h1>data: {state.data}</h1>
          <h2>error: {state.error?.message}</h2>
          <p>placeholder data: {state.isPlaceholderData}</p>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page count={0} />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 0')
    rendered.rerender(<Page count={1} />)
    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1')
    rendered.rerender(<Page count={2} />)
    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('error: Error test')

    expect(states.length).toBe(6)
    // Initial
    expect(states[0]).toMatchObject({
      data: undefined,
      isFetching: true,
      status: 'pending',
      error: null,
      isPlaceholderData: false,
    })
    // Fetched
    expect(states[1]).toMatchObject({
      data: 0,
      isFetching: false,
      status: 'success',
      error: null,
      isPlaceholderData: false,
    })
    // rerender Page 1
    expect(states[2]).toMatchObject({
      data: 0,
      isFetching: true,
      status: 'success',
      error: null,
      isPlaceholderData: true,
    })
    // New data
    expect(states[3]).toMatchObject({
      data: 1,
      isFetching: false,
      status: 'success',
      error: null,
      isPlaceholderData: false,
    })
    // rerender Page 2
    expect(states[4]).toMatchObject({
      data: 1,
      isFetching: true,
      status: 'success',
      error: null,
      isPlaceholderData: true,
    })
    // Error
    expect(states[5]).toMatchObject({
      data: undefined,
      isFetching: false,
      status: 'error',
      isPlaceholderData: false,
    })
    expect(states[5]!.error).toHaveProperty('message', 'Error test')
  })

  it('should not show initial data from next query if placeholderData is set', async () => {
    const key = queryKey()
    const states: Array<DefinedUseQueryResult<number>> = []

    function Page() {
      const [count, setCount] = React.useState(0)

      const state = useQuery({
        queryKey: [key, count],
        queryFn: async () => {
          await sleep(10)
          return count
        },
        initialData: 99,
        placeholderData: keepPreviousData,
      })

      states.push(state)

      return (
        <div>
          <h1>
            data: {state.data}, count: {count}, isFetching:{' '}
            {String(state.isFetching)}
          </h1>
          <button onClick={() => setCount(1)}>inc</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 0, count: 0, isFetching: false')

    fireEvent.click(rendered.getByRole('button', { name: 'inc' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1, count: 1, isFetching: false')

    expect(states.length).toBe(4)

    // Initial
    expect(states[0]).toMatchObject({
      data: 99,
      isFetching: true,
      isSuccess: true,
      isPlaceholderData: false,
    })
    // Fetched
    expect(states[1]).toMatchObject({
      data: 0,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
    // Set state
    expect(states[2]).toMatchObject({
      data: 99,
      isFetching: true,
      isSuccess: true,
      isPlaceholderData: false,
    })
    // New data
    expect(states[3]).toMatchObject({
      data: 1,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
  })

  it('should keep the previous data on disabled query when placeholderData is set', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []

    function Page() {
      const [count, setCount] = React.useState(0)

      const state = useQuery({
        queryKey: [key, count],
        queryFn: async () => {
          await sleep(10)
          return count
        },
        enabled: false,
        placeholderData: keepPreviousData,
        notifyOnChangeProps: 'all',
      })

      states.push(state)

      return (
        <div>
          <button onClick={() => state.refetch()}>refetch</button>
          <button onClick={() => setCount(1)}>setCount</button>
          <div>data: {state.data ?? 'undefined'}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    rendered.getByText('data: undefined')

    fireEvent.click(rendered.getByRole('button', { name: 'refetch' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 0')

    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 0')

    fireEvent.click(rendered.getByRole('button', { name: 'refetch' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1')

    expect(states.length).toBe(6)

    // Disabled query
    expect(states[0]).toMatchObject({
      data: undefined,
      isFetching: false,
      isSuccess: false,
      isPlaceholderData: false,
    })
    // Fetching query
    expect(states[1]).toMatchObject({
      data: undefined,
      isFetching: true,
      isSuccess: false,
      isPlaceholderData: false,
    })
    // Fetched query
    expect(states[2]).toMatchObject({
      data: 0,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
    // Set state
    expect(states[3]).toMatchObject({
      data: 0,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // Fetching new query
    expect(states[4]).toMatchObject({
      data: 0,
      isFetching: true,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // Fetched new query
    expect(states[5]).toMatchObject({
      data: 1,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
  })

  it('should keep the previous data on disabled query when placeholderData is set and switching query key multiple times', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []

    queryClient.setQueryData([key, 10], 10)

    await vi.advanceTimersByTimeAsync(10)

    function Page() {
      const [count, setCount] = React.useState(10)

      const state = useQuery({
        queryKey: [key, count],
        queryFn: async () => {
          await sleep(10)
          return count
        },
        enabled: false,
        placeholderData: keepPreviousData,
        notifyOnChangeProps: 'all',
      })

      states.push(state)

      const { refetch } = state

      React.useEffect(() => {
        setActTimeout(() => {
          setCount(11)
        }, 20)
        setActTimeout(() => {
          setCount(12)
        }, 30)
        setActTimeout(() => {
          refetch()
        }, 40)
      }, [refetch])

      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(51)

    expect(states.length).toBe(5)

    // Disabled query
    expect(states[0]).toMatchObject({
      data: 10,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
    // Set state
    expect(states[1]).toMatchObject({
      data: 10,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // State update
    expect(states[2]).toMatchObject({
      data: 10,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // Refetch
    expect(states[3]).toMatchObject({
      data: 10,
      isFetching: true,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // Refetch done
    expect(states[4]).toMatchObject({
      data: 12,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
  })

  it('should use the correct query function when components use different configurations', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []

    function FirstComponent() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 1
        },
        notifyOnChangeProps: 'all',
      })
      const refetch = state.refetch

      states.push(state)

      return (
        <div>
          <button onClick={() => refetch()}>refetch</button>
          data: {state.data}
        </div>
      )
    }

    function SecondComponent() {
      useQuery({ queryKey: key, queryFn: () => 2, notifyOnChangeProps: 'all' })
      return null
    }

    function Page() {
      return (
        <>
          <FirstComponent />
          <SecondComponent />
        </>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1')
    fireEvent.click(rendered.getByRole('button', { name: /refetch/i }))

    await vi.advanceTimersByTimeAsync(11)
    expect(states.length).toBe(4)

    expect(states[0]).toMatchObject({
      data: undefined,
    })
    expect(states[1]).toMatchObject({
      data: 1,
    })
    expect(states[2]).toMatchObject({
      data: 1,
    })
    // This state should be 1 instead of 2
    expect(states[3]).toMatchObject({
      data: 1,
    })
  })

  it('should be able to set different stale times for a query', async () => {
    const key = queryKey()
    const states1: Array<UseQueryResult<string>> = []
    const states2: Array<UseQueryResult<string>> = []

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        await sleep(10)
        return 'prefetch'
      },
    })

    await vi.advanceTimersByTimeAsync(20)

    function FirstComponent() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 'one'
        },

        staleTime: 100,
      })
      states1.push(state)
      return null
    }

    function SecondComponent() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 'two'
        },

        staleTime: 10,
      })
      states2.push(state)
      return null
    }

    function Page() {
      return (
        <>
          <FirstComponent />
          <SecondComponent />
        </>
      )
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(200)

    expect(states1.length).toBe(4)
    expect(states2.length).toBe(3)

    expect(states1).toMatchObject([
      // First render
      {
        data: 'prefetch',
        isStale: false,
      },
      // Second useQuery started fetching
      {
        data: 'prefetch',
        isStale: false,
      },
      // Second useQuery data came in
      {
        data: 'two',
        isStale: false,
      },
      // Data became stale after 100ms
      {
        data: 'two',
        isStale: true,
      },
    ])

    expect(states2).toMatchObject([
      // First render, data is stale and starts fetching
      {
        data: 'prefetch',
        isStale: true,
      },
      // Second useQuery data came in
      {
        data: 'two',
        isStale: false,
      },
      // Data became stale after 5ms
      {
        data: 'two',
        isStale: true,
      },
    ])
  })

  it('should re-render when a query becomes stale', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => 'test',
        staleTime: 50,
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(100)

    expect(states.length).toBe(3)
    expect(states[0]).toMatchObject({ isStale: true })
    expect(states[1]).toMatchObject({ isStale: false })
    expect(states[2]).toMatchObject({ isStale: true })
  })

  it('should re-render disabled observers when other observers trigger a query (#8741)', async () => {
    const key = queryKey()

    const useUserInfoQuery = ({
      id,
      enabled,
    }: {
      id: number | null
      enabled: boolean
    }) => {
      return useQuery({
        queryKey: [key, id],
        queryFn: async () => {
          await sleep(10)
          return { id, name: 'John' }
        },
        enabled: !!id && enabled,
      })
    }

    const Page = () => {
      const [id, setId] = React.useState<number | null>(null)

      const searchQuery = useUserInfoQuery({ id, enabled: false })

      return (
        <>
          <div>User fetching status is {searchQuery.fetchStatus}</div>
          <UserInfo id={id} />
          <button onClick={() => setId(42)}>
            Set ID and trigger user load
          </button>
        </>
      )
    }

    function UserInfo({ id }: { id: number | null }) {
      const searchQuery = useUserInfoQuery({ id, enabled: true })

      return <div>UserInfo data is {JSON.stringify(searchQuery.data)} </div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    rendered.getByText('User fetching status is idle')

    fireEvent.click(rendered.getByRole('button', { name: /set id/i }))

    await vi.advanceTimersByTimeAsync(0)
    expect(
      rendered.getByText('User fetching status is fetching'),
    ).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(11)
    expect(
      rendered.getByText('UserInfo data is {"id":42,"name":"John"}'),
    ).toBeInTheDocument()

    expect(
      rendered.getByText('User fetching status is idle'),
    ).toBeInTheDocument()
  })

  describe('notifyOnChangeProps', () => {
    it('should not re-render when it should only re-render only data change and the selected data did not change', async () => {
      const key = queryKey()
      const states: Array<UseQueryResult<string>> = []

      function Page() {
        const state = useQuery({
          queryKey: key,
          queryFn: () => ({ name: 'test' }),
          select: (data) => data.name,
          notifyOnChangeProps: ['data'],
        })

        states.push(state)

        return (
          <div>
            <div>{state.data}</div>
            <button onClick={() => state.refetch()}>refetch</button>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      await vi.advanceTimersByTimeAsync(0)
      rendered.getByText('test')

      fireEvent.click(rendered.getByRole('button', { name: 'refetch' }))

      await vi.advanceTimersByTimeAsync(0)
      rendered.getByText('test')

      expect(states[0]).toMatchObject({ data: undefined })
      expect(states[1]).toMatchObject({ data: 'test' })

      // make sure no additional renders happen
      await vi.advanceTimersByTimeAsync(50)
      expect(states.length).toBe(2)
    })
    it('should not re-render when it should only re-render on data changes and the data did not change', async () => {
      const key = queryKey()
      const states: Array<UseQueryResult<string>> = []

      function Page() {
        const state = useQuery({
          queryKey: key,
          queryFn: async () => {
            await sleep(5)
            return 'test'
          },

          notifyOnChangeProps: ['data'],
        })

        states.push(state)

        return (
          <>
            <button
              onClick={async () => {
                await state.refetch()
              }}
            >
              refetch
            </button>

            <div>{state.data}</div>
          </>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      await vi.advanceTimersByTimeAsync(6)
      rendered.getByText('test')

      fireEvent.click(rendered.getByRole('button', { name: 'refetch' }))

      // sleep is required to make sure no additional renders happen after click
      await vi.advanceTimersByTimeAsync(20)

      expect(states.length).toBe(2)
      expect(states[0]).toMatchObject({
        data: undefined,
        status: 'pending',
        isFetching: true,
      })
      expect(states[1]).toMatchObject({
        data: 'test',
        status: 'success',
        isFetching: false,
      })
    })

    // See https://github.com/TanStack/query/discussions/5588
    describe('function', () => {
      it('should not re-render when it should only re-render on data changes and the data did not change', async () => {
        const key = queryKey()
        const states: Array<UseQueryResult<string>> = []

        function Page() {
          const state = useQuery({
            queryKey: key,
            queryFn: async () => {
              await sleep(5)
              return 'test'
            },
            notifyOnChangeProps: () => ['data'],
          })

          states.push(state)

          return (
            <>
              <button
                onClick={async () => {
                  await state.refetch()
                }}
              >
                refetch
              </button>

              <div>{state.data}</div>
            </>
          )
        }

        const rendered = renderWithClient(queryClient, <Page />)

        await vi.advanceTimersByTimeAsync(6)
        rendered.getByText('test')

        fireEvent.click(rendered.getByRole('button', { name: 'refetch' }))

        await vi.advanceTimersByTimeAsync(20)

        expect(states.length).toBe(2)
        expect(states[0]).toMatchObject({
          data: undefined,
          status: 'pending',
          isFetching: true,
        })
        expect(states[1]).toMatchObject({
          data: 'test',
          status: 'success',
          isFetching: false,
        })
      })

      it('should not re-render when change props are not actively being tracked', async () => {
        const key = queryKey()
        const states: Array<UseQueryResult<string>> = []

        function Page() {
          const fetchCounterRef = React.useRef(0)
          const trackChangesRef = React.useRef(true)

          const notifyOnChangeProps = React.useCallback(() => {
            return trackChangesRef.current ? 'all' : []
          }, [])

          const state = useQuery({
            queryKey: key,
            queryFn: async () => {
              await sleep(5)
              fetchCounterRef.current++
              return `fetch counter: ${fetchCounterRef.current}`
            },
            notifyOnChangeProps,
          })

          states.push(state)

          return (
            <>
              <button
                onClick={async () => {
                  await state.refetch()
                }}
              >
                refetch
              </button>
              <button
                onClick={() => {
                  trackChangesRef.current = true
                }}
              >
                enableTracking
              </button>
              <button
                onClick={() => {
                  trackChangesRef.current = false
                }}
              >
                disableTracking
              </button>

              <div>{state.data}</div>
            </>
          )
        }

        const rendered = renderWithClient(queryClient, <Page />)
        await vi.advanceTimersByTimeAsync(6)
        rendered.getByText('fetch counter: 1')

        expect(states.length).toBe(2)
        expect(states[0]).toMatchObject({
          data: undefined,
          isFetching: true,
          status: 'pending',
        })
        expect(states[1]).toMatchObject({
          data: 'fetch counter: 1',
          status: 'success',
          isFetching: false,
        })

        // disable tracking and refetch to check for re-renders
        fireEvent.click(
          rendered.getByRole('button', { name: 'disableTracking' }),
        )
        fireEvent.click(rendered.getByRole('button', { name: 'refetch' }))

        await vi.advanceTimersByTimeAsync(20)
        // still expect to only have two re-renders from the initial fetch
        expect(states.length).toBe(2)

        // enable tracking and refetch to check for re-renders
        fireEvent.click(
          rendered.getByRole('button', { name: 'enableTracking' }),
        )
        fireEvent.click(rendered.getByRole('button', { name: 'refetch' }))

        await vi.advanceTimersByTimeAsync(6)
        rendered.getByText('fetch counter: 3')
        await vi.advanceTimersByTimeAsync(20)

        expect(states.length).toBe(4)
        expect(states[2]).toMatchObject({
          data: 'fetch counter: 2',
          status: 'success',
          isFetching: true,
        })
        expect(states[3]).toMatchObject({
          data: 'fetch counter: 3',
          status: 'success',
          isFetching: false,
        })
      })
    })
  })

  // See https://github.com/tannerlinsley/react-query/issues/137
  it('should not override initial data in dependent queries', () => {
    const key1 = queryKey()
    const key2 = queryKey()

    function Page() {
      const first = useQuery({
        queryKey: key1,
        queryFn: () => 'data',
        enabled: false,
        initialData: 'init',
      })

      const second = useQuery({
        queryKey: key2,
        queryFn: () => 'data',
        enabled: false,
        initialData: 'init',
      })

      return (
        <div>
          <h2>First Data: {first.data}</h2>
          <h2>Second Data: {second.data}</h2>
          <div>First Status: {first.status}</div>
          <div>Second Status: {second.status}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    expect(rendered.getByText('First Data: init')).toBeInTheDocument()
    expect(rendered.getByText('Second Data: init')).toBeInTheDocument()
    expect(rendered.getByText('First Status: success')).toBeInTheDocument()
    expect(rendered.getByText('Second Status: success')).toBeInTheDocument()
  })

  it('should update query options', () => {
    const key = queryKey()

    const queryFn = async () => {
      await sleep(10)
      return 'data1'
    }

    function Page() {
      useQuery({ queryKey: key, queryFn, retryDelay: 10 })
      useQuery({ queryKey: key, queryFn, retryDelay: 20 })
      return null
    }

    renderWithClient(queryClient, <Page />)

    expect(queryCache.find({ queryKey: key })!.options.retryDelay).toBe(20)
  })

  it('should batch re-renders', async () => {
    const key = queryKey()

    let renders = 0

    const queryFn = async () => {
      await sleep(15)
      return 'data'
    }

    function Page() {
      const query1 = useQuery({ queryKey: key, queryFn })
      const query2 = useQuery({ queryKey: key, queryFn })
      renders++

      return (
        <div>
          {query1.data} {query2.data}
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(16)
    rendered.getByText('data data')

    // Should be 2 instead of 3
    expect(renders).toBe(2)
  })

  it('should render latest data even if react has discarded certain renders', async () => {
    const key = queryKey()

    function Page() {
      const [, setNewState] = React.useState('state')
      const state = useQuery({ queryKey: key, queryFn: () => 'data' })
      React.useEffect(() => {
        setActTimeout(() => {
          queryClient.setQueryData(key, 'new')
          // Update with same state to make react discard the next render
          setNewState('state')
        }, 10)
      }, [])
      return <div>{state.data}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('new')).toBeInTheDocument()
  })

  // See https://github.com/tannerlinsley/react-query/issues/170
  it('should start with status pending, fetchStatus idle if enabled is false', async () => {
    const key1 = queryKey()
    const key2 = queryKey()

    function Page() {
      const first = useQuery({
        queryKey: key1,
        queryFn: async () => {
          await sleep(10)
          return 'data'
        },
        enabled: false,
      })
      const second = useQuery({
        queryKey: key2,
        queryFn: async () => {
          await sleep(10)
          return 'data'
        },
      })

      return (
        <div>
          <div>
            First Status: {first.status}, {first.fetchStatus}
          </div>
          <div>
            Second Status: {second.status}, {second.fetchStatus}
          </div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    // use "act" to wait for state update and prevent console warning

    expect(
      rendered.getByText('First Status: pending, idle'),
    ).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(0)
    expect(
      rendered.getByText('Second Status: pending, fetching'),
    ).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(11)
    expect(
      rendered.getByText('Second Status: success, idle'),
    ).toBeInTheDocument()
  })

  // See https://github.com/tannerlinsley/react-query/issues/144
  it('should be in "pending" state by default', () => {
    const key = queryKey()

    function Page() {
      const { status } = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 'test'
        },
      })

      return <div>status: {status}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    expect(rendered.getByText('status: pending')).toBeInTheDocument()
  })

  it('should not refetch query on focus when `enabled` is set to `false`', async () => {
    const key = queryKey()
    const queryFn = vi
      .fn<(...args: Array<unknown>) => string>()
      .mockReturnValue('data')

    function Page() {
      const { data = 'default' } = useQuery({
        queryKey: key,
        queryFn,
        enabled: false,
      })

      return (
        <div>
          <h1>{data}</h1>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('default')

    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })

    expect(queryFn).not.toHaveBeenCalled()
  })

  it('should not refetch stale query on focus when `refetchOnWindowFocus` is set to `false`', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => count++,
        staleTime: 0,
        refetchOnWindowFocus: false,
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(10)

    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })

    await vi.advanceTimersByTimeAsync(10)

    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({ data: undefined, isFetching: true })
    expect(states[1]).toMatchObject({ data: 0, isFetching: false })
  })

  it('should not refetch stale query on focus when `refetchOnWindowFocus` is set to a function that returns `false`', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => count++,
        staleTime: 0,
        refetchOnWindowFocus: () => false,
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(10)

    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })

    await vi.advanceTimersByTimeAsync(10)

    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({ data: undefined, isFetching: true })
    expect(states[1]).toMatchObject({ data: 0, isFetching: false })
  })

  it('should not refetch fresh query on focus when `refetchOnWindowFocus` is set to `true`', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => count++,
        staleTime: Infinity,
        refetchOnWindowFocus: true,
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(10)

    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })

    await vi.advanceTimersByTimeAsync(10)

    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({ data: undefined, isFetching: true })
    expect(states[1]).toMatchObject({ data: 0, isFetching: false })
  })

  it('should refetch fresh query on focus when `refetchOnWindowFocus` is set to `always`', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return count++
        },

        staleTime: Infinity,
        refetchOnWindowFocus: 'always',
      })
      states.push(state)
      return (
        <div>
          <div>
            data: {state.data}, isFetching: {String(state.isFetching)}
          </div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('data: 0, isFetching: false')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })

    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('data: 1, isFetching: false')).toBeInTheDocument()
  })

  it('should calculate focus behavior for `refetchOnWindowFocus` depending on function', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return count++
        },

        staleTime: 0,
        retry: 0,
        refetchOnWindowFocus: (query) => (query.state.data || 0) < 1,
      })
      states.push(state)
      return <div>data: {String(state.data)}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 0')

    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({ data: undefined, isFetching: true })
    expect(states[1]).toMatchObject({ data: 0, isFetching: false })

    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1')

    // refetch should happen
    expect(states.length).toBe(4)

    expect(states[2]).toMatchObject({ data: 0, isFetching: true })
    expect(states[3]).toMatchObject({ data: 1, isFetching: false })

    act(() => {
      window.dispatchEvent(new Event('visibilitychange'))
    })

    await vi.advanceTimersByTimeAsync(20)

    // no more refetch now
    expect(states.length).toBe(4)
  })

  it('should refetch fresh query when refetchOnMount is set to always', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: () => 'prefetched',
    })

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => 'data',
        refetchOnMount: 'always',
        staleTime: Infinity,
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)

    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({
      data: 'prefetched',
      isStale: false,
      isFetching: true,
    })
    expect(states[1]).toMatchObject({
      data: 'data',
      isStale: false,
      isFetching: false,
    })
  })

  it('should refetch stale query when refetchOnMount is set to true', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: () => 'prefetched',
    })

    await vi.advanceTimersByTimeAsync(0)

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => 'data',
        refetchOnMount: true,
        staleTime: 0,
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)

    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({
      data: 'prefetched',
      isStale: true,
      isFetching: true,
    })
    expect(states[1]).toMatchObject({
      data: 'data',
      isStale: true,
      isFetching: false,
    })
  })

  it('should set status to error if queryFn throws', async () => {
    const consoleMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const key = queryKey()

    function Page() {
      const { status, error } = useQuery({
        queryKey: key,
        queryFn: () => {
          return Promise.reject(new Error('Error test'))
        },
        retry: false,
      })

      return (
        <div>
          <h1>{status}</h1>
          <h2>{error?.message}</h2>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('error')).toBeInTheDocument()
    expect(rendered.getByText('Error test')).toBeInTheDocument()
    consoleMock.mockRestore()
  })

  it('should throw error if queryFn throws and throwOnError is in use', async () => {
    const consoleMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const key = queryKey()

    function Page() {
      const { status, error } = useQuery<unknown, string>({
        queryKey: key,
        queryFn: () => Promise.reject(new Error('Error test')),
        retry: false,
        throwOnError: true,
      })

      return (
        <div>
          <h1>{status}</h1>
          <h2>{error}</h2>
        </div>
      )
    }

    const rendered = renderWithClient(
      queryClient,
      <ErrorBoundary fallbackRender={() => <div>error boundary</div>}>
        <Page />
      </ErrorBoundary>,
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('error boundary')).toBeInTheDocument()
    consoleMock.mockRestore()
  })

  it('should update with data if we observe no properties and throwOnError', async () => {
    const key = queryKey()

    let result: UseQueryResult<string> | undefined

    function Page() {
      const query = useQuery({
        queryKey: key,
        queryFn: () => Promise.resolve('data'),
        throwOnError: true,
      })

      React.useEffect(() => {
        result = query
      })

      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(queryClient.isFetching()).toBe(0)

    expect(result?.data).toBe('data')
  })

  it('should set status to error instead of throwing when error should not be thrown', async () => {
    const key = queryKey()

    function Page() {
      const { status, error } = useQuery({
        queryKey: key,
        queryFn: () => Promise.reject(new Error('Local Error')),

        retry: false,
        throwOnError: (err) => err.message !== 'Local Error',
      })

      return (
        <div>
          <h1>{status}</h1>
          <h2>{error?.message}</h2>
        </div>
      )
    }

    const rendered = renderWithClient(
      queryClient,
      <ErrorBoundary fallbackRender={() => <div>error boundary</div>}>
        <Page />
      </ErrorBoundary>,
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('error')).toBeInTheDocument()
    expect(rendered.getByText('Local Error')).toBeInTheDocument()
  })

  it('should throw error instead of setting status when error should be thrown', async () => {
    const consoleMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const key = queryKey()

    function Page() {
      const { status, error } = useQuery<unknown, Error>({
        queryKey: key,
        queryFn: () => Promise.reject(new Error('Remote Error')),

        retry: false,
        throwOnError: (err) => err.message !== 'Local Error',
      })

      return (
        <div>
          <h1>{status}</h1>
          <h2>{error?.message ?? ''}</h2>
        </div>
      )
    }

    const rendered = renderWithClient(
      queryClient,
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <div>
            <div>error boundary</div>
            <div>{error?.message}</div>
          </div>
        )}
      >
        <Page />
      </ErrorBoundary>,
    )

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('error boundary')).toBeInTheDocument()
    expect(rendered.getByText('Remote Error')).toBeInTheDocument()
    consoleMock.mockRestore()
  })

  it('should continue retries when observers unmount and remount while waiting for a retry (#3031)', async () => {
    const key = queryKey()
    let count = 0

    function Page() {
      const result = useQuery({
        queryKey: key,
        queryFn: async () => {
          count++
          await sleep(10)
          return Promise.reject(new Error('some error'))
        },

        retry: 2,
        retryDelay: 100,
      })

      return (
        <div>
          <div>error: {result.error?.message ?? 'null'}</div>
          <div>failureCount: {result.failureCount}</div>
          <div>failureReason: {result.failureReason?.message}</div>
        </div>
      )
    }

    function App() {
      const [show, toggle] = React.useReducer((x) => !x, true)

      return (
        <div>
          <button onClick={toggle}>{show ? 'hide' : 'show'}</button>
          {show && <Page />}
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <App />)

    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('failureCount: 1')).toBeInTheDocument()
    expect(rendered.getByText('failureReason: some error')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(90)
    fireEvent.click(rendered.getByRole('button', { name: /hide/i }))
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByRole('button', { name: /show/i })).toBeInTheDocument()
    fireEvent.click(rendered.getByRole('button', { name: /show/i }))
    await vi.advanceTimersByTimeAsync(11)
    await vi.advanceTimersByTimeAsync(110)
    await vi.advanceTimersByTimeAsync(110)
    expect(rendered.getByText('error: some error')).toBeInTheDocument()

    expect(count).toBe(4)
  })

  it('should restart when observers unmount and remount while waiting for a retry when query was cancelled in between (#3031)', async () => {
    const key = queryKey()
    let count = 0

    function Page() {
      const result = useQuery({
        queryKey: key,
        queryFn: async () => {
          count++
          await sleep(10)
          return Promise.reject(new Error('some error'))
        },

        retry: 2,
        retryDelay: 100,
      })

      return (
        <div>
          <div>error: {result.error?.message ?? 'null'}</div>
          <div>failureCount: {result.failureCount}</div>
          <div>failureReason: {result.failureReason?.message}</div>
        </div>
      )
    }

    function App() {
      const [show, toggle] = React.useReducer((x) => !x, true)

      return (
        <div>
          <button onClick={toggle}>{show ? 'hide' : 'show'}</button>
          <button onClick={() => queryClient.cancelQueries({ queryKey: key })}>
            cancel
          </button>
          {show && <Page />}
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <App />)

    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('failureCount: 1')).toBeInTheDocument()
    expect(rendered.getByText('failureReason: some error')).toBeInTheDocument()
    fireEvent.click(rendered.getByRole('button', { name: /hide/i }))
    fireEvent.click(rendered.getByRole('button', { name: /cancel/i }))
    expect(rendered.getByRole('button', { name: /show/i })).toBeInTheDocument()
    fireEvent.click(rendered.getByRole('button', { name: /show/i }))
    await vi.advanceTimersByTimeAsync(11)
    await vi.advanceTimersByTimeAsync(110)
    await vi.advanceTimersByTimeAsync(110)
    expect(rendered.getByText('error: some error')).toBeInTheDocument()

    // initial fetch (1), which will be cancelled, followed by new mount(2) + 2 retries = 4
    expect(count).toBe(4)
  })

  it('should always fetch if refetchOnMount is set to always', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: () => 'prefetched',
    })

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => 'data',
        refetchOnMount: 'always',
        staleTime: 50,
      })
      states.push(state)
      return (
        <div>
          <div>data: {state.data ?? 'null'}</div>
          <div>isFetching: {state.isFetching}</div>
          <div>isStale: {state.isStale}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('data: data')
    await vi.advanceTimersByTimeAsync(52)
    expect(states.length).toBe(3)

    expect(states[0]).toMatchObject({
      data: 'prefetched',
      isStale: false,
      isFetching: true,
    })
    expect(states[1]).toMatchObject({
      data: 'data',
      isStale: false,
      isFetching: false,
    })
    expect(states[2]).toMatchObject({
      data: 'data',
      isStale: true,
      isFetching: false,
    })
  })

  it('should fetch if initial data is set', async () => {
    const key = queryKey()
    const states: Array<DefinedUseQueryResult<string>> = []

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => 'data',
        initialData: 'initial',
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)

    expect(states.length).toBe(2)

    expect(states[0]).toMatchObject({
      data: 'initial',
      isStale: true,
      isFetching: true,
    })
    expect(states[1]).toMatchObject({
      data: 'data',
      isStale: true,
      isFetching: false,
    })
  })

  it('should not fetch if initial data is set with a stale time', async () => {
    const key = queryKey()
    const states: Array<DefinedUseQueryResult<string>> = []

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => 'data',
        staleTime: 50,
        initialData: 'initial',
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(52)

    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({
      data: 'initial',
      isStale: false,
      isFetching: false,
    })
    expect(states[1]).toMatchObject({
      data: 'initial',
      isStale: true,
      isFetching: false,
    })
  })

  it('should fetch if initial data updated at is older than stale time', async () => {
    const key = queryKey()
    const states: Array<DefinedUseQueryResult<string>> = []

    const oneSecondAgo = Date.now() - 1000

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => 'data',
        staleTime: 50,
        initialData: 'initial',
        initialDataUpdatedAt: oneSecondAgo,
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(52)

    expect(states.length).toBe(3)
    expect(states[0]).toMatchObject({
      data: 'initial',
      isStale: true,
      isFetching: true,
    })
    expect(states[1]).toMatchObject({
      data: 'data',
      isStale: false,
      isFetching: false,
    })
    expect(states[2]).toMatchObject({
      data: 'data',
      isStale: true,
      isFetching: false,
    })
  })

  it('should fetch if "initial data updated at" is exactly 0', async () => {
    const key = queryKey()
    const states: Array<DefinedUseQueryResult<string>> = []

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: () => 'data',
        staleTime: 10 * 1000, // 10 seconds
        initialData: 'initial',
        initialDataUpdatedAt: 0,
      })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)

    expect(states.length).toBe(2)
    expect(states[0]).toMatchObject({
      data: 'initial',
      isStale: true,
      isFetching: true,
    })
    expect(states[1]).toMatchObject({
      data: 'data',
      isStale: false,
      isFetching: false,
    })
  })

  it('should keep initial data when the query key changes', async () => {
    const key = queryKey()
    const states: Array<DefinedUseQueryResult<{ count: number }>> = []

    function Page() {
      const [count, setCount] = React.useState(0)
      const state = useQuery({
        queryKey: [key, count],
        queryFn: () => ({ count: 10 }),
        staleTime: Infinity,
        initialData: () => ({ count }),
      })
      states.push(state)

      React.useEffect(() => {
        setActTimeout(() => {
          setCount(1)
        }, 10)
      }, [])

      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)

    expect(states.length).toBe(2)
    // Initial
    expect(states[0]).toMatchObject({ data: { count: 0 } })
    // Set state
    expect(states[1]).toMatchObject({ data: { count: 1 } })
  })

  it('should retry specified number of times', async () => {
    const key = queryKey()

    const queryFn = vi.fn<(...args: Array<unknown>) => unknown>()
    queryFn.mockImplementation(() => {
      return Promise.reject(new Error('Error test Barrett'))
    })

    function Page() {
      const { status, failureCount, failureReason } = useQuery({
        queryKey: key,
        queryFn,
        retry: 1,
        retryDelay: 1,
      })

      return (
        <div>
          <h1>{status}</h1>
          <h2>Failed {failureCount} times</h2>
          <h2>Failed because {failureReason?.message}</h2>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    rendered.getByText('pending')
    await vi.advanceTimersByTimeAsync(2)
    rendered.getByText('error')

    // query should fail `retry + 1` times, since first time isn't a "retry"
    rendered.getByText('Failed 2 times')
    rendered.getByText('Failed because Error test Barrett')

    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  it('should not retry if retry function `false`', async () => {
    const key = queryKey()

    const queryFn = vi.fn<(...args: Array<unknown>) => unknown>()

    queryFn.mockImplementationOnce(() => {
      return Promise.reject(new Error('Error test Tanner'))
    })

    queryFn.mockImplementation(() => {
      return Promise.reject(new Error('NoRetry'))
    })

    function Page() {
      const { status, failureCount, failureReason, error } = useQuery({
        queryKey: key,
        queryFn,
        retryDelay: 1,
        retry: (_failureCount, err) => err.message !== 'NoRetry',
      })

      return (
        <div>
          <h1>{status}</h1>
          <h2>Failed {failureCount} times</h2>
          <h2>Failed because {failureReason?.message}</h2>
          <h2>{error?.message}</h2>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    rendered.getByText('pending')
    await vi.advanceTimersByTimeAsync(2)
    rendered.getByText('error')

    rendered.getByText('Failed 2 times')
    rendered.getByText('Failed because NoRetry')

    rendered.getByText('NoRetry')

    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  it('should extract retryDelay from error', async () => {
    const key = queryKey()

    type DelayError = { delay: number }

    const queryFn = vi.fn<(...args: Array<unknown>) => unknown>()
    queryFn.mockImplementation(() => {
      return Promise.reject({ delay: 50 })
    })

    function Page() {
      const { status, failureCount, failureReason } = useQuery({
        queryKey: key,
        queryFn,
        retry: 1,
        retryDelay: (_, error: DelayError) => error.delay,
      })

      return (
        <div>
          <h1>{status}</h1>
          <h2>Failed {failureCount} times</h2>
          <h2>Failed because DelayError: {failureReason?.delay}ms</h2>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)

    expect(queryFn).toHaveBeenCalledTimes(1)

    rendered.getByText('Failed because DelayError: 50ms')
    await vi.advanceTimersByTimeAsync(51)
    rendered.getByText('Failed 2 times')

    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  // See https://github.com/tannerlinsley/react-query/issues/160
  it('should continue retry after focus regain', async () => {
    const key = queryKey()

    // make page unfocused
    const visibilityMock = mockVisibilityState('hidden')

    let count = 0

    function Page() {
      const query = useQuery<unknown, string>({
        queryKey: key,
        queryFn: () => {
          count++
          return Promise.reject<unknown>(`fetching error ${count}`)
        },
        retry: 3,
        retryDelay: 1,
      })

      return (
        <div>
          <div>error {String(query.error)}</div>
          <div>status {query.status}</div>
          <div>failureCount {query.failureCount}</div>
          <div>failureReason {query.failureReason}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    // The query should display the first error result
    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('failureCount 1')).toBeInTheDocument()
    expect(
      rendered.getByText('failureReason fetching error 1'),
    ).toBeInTheDocument()
    expect(rendered.getByText('status pending')).toBeInTheDocument()
    expect(rendered.getByText('error null')).toBeInTheDocument()

    // Check if the query really paused
    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('failureCount 1')).toBeInTheDocument()
    expect(
      rendered.getByText('failureReason fetching error 1'),
    ).toBeInTheDocument()

    act(() => {
      // reset visibilityState to original value
      visibilityMock.mockRestore()
      window.dispatchEvent(new Event('visibilitychange'))
    })

    // Wait for the final result
    await vi.advanceTimersByTimeAsync(4)
    expect(rendered.getByText('failureCount 4')).toBeInTheDocument()
    expect(
      rendered.getByText('failureReason fetching error 4'),
    ).toBeInTheDocument()
    expect(rendered.getByText('status error')).toBeInTheDocument()
    expect(rendered.getByText('error fetching error 4')).toBeInTheDocument()

    // Check if the query really stopped
    await vi.advanceTimersByTimeAsync(10)
    expect(rendered.getByText('failureCount 4')).toBeInTheDocument()
    expect(
      rendered.getByText('failureReason fetching error 4'),
    ).toBeInTheDocument()
  })

  it('should fetch on mount when a query was already created with setQueryData', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    queryClient.setQueryData(key, 'prefetched')

    function Page() {
      const state = useQuery({ queryKey: key, queryFn: () => 'data' })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)

    expect(states.length).toBe(2)
    expect(states).toMatchObject([
      {
        data: 'prefetched',
        isFetching: true,
        isStale: true,
      },
      {
        data: 'data',
        isFetching: false,
        isStale: true,
      },
    ])
  })

  it('should refetch after focus regain', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    // make page unfocused
    const visibilityMock = mockVisibilityState('hidden')

    // set data in cache to check if the hook query fn is actually called
    queryClient.setQueryData(key, 'prefetched')

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 'data'
        },
      })
      states.push(state)
      return (
        <div>
          {state.data}, {state.isStale}, {state.isFetching}
        </div>
      )
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    expect(states.length).toBe(2)

    act(() => {
      // reset visibilityState to original value
      visibilityMock.mockRestore()
      window.dispatchEvent(new Event('visibilitychange'))
    })

    await vi.advanceTimersByTimeAsync(11)
    expect(states.length).toBe(4)

    expect(states).toMatchObject([
      {
        data: 'prefetched',
        isFetching: true,
        isStale: true,
      },
      {
        data: 'data',
        isFetching: false,
        isStale: true,
      },
      {
        data: 'data',
        isFetching: true,
        isStale: true,
      },
      {
        data: 'data',
        isFetching: false,
        isStale: true,
      },
    ])
  })

  // See https://github.com/tannerlinsley/react-query/issues/195
  it('should refetch if stale after a prefetch', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    const queryFn = vi.fn<(...args: Array<unknown>) => string>()
    queryFn.mockImplementation(() => 'data')

    const prefetchQueryFn = vi.fn<(...args: Array<unknown>) => string>()
    prefetchQueryFn.mockImplementation(() => 'not yet...')

    await queryClient.prefetchQuery({
      queryKey: key,
      queryFn: prefetchQueryFn,
      staleTime: 10,
    })

    await vi.advanceTimersByTimeAsync(10)

    function Page() {
      const state = useQuery({ queryKey: key, queryFn })
      states.push(state)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    expect(states.length).toBe(2)

    expect(prefetchQueryFn).toHaveBeenCalledTimes(1)
    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it('should not refetch if not stale after a prefetch', async () => {
    const key = queryKey()

    const queryFn = vi.fn<(...args: Array<unknown>) => string>()
    queryFn.mockImplementation(() => 'data')

    const prefetchQueryFn =
      vi.fn<(...args: Array<unknown>) => Promise<string>>()
    prefetchQueryFn.mockImplementation(async () => {
      await sleep(10)
      return 'not yet...'
    })

    queryClient.prefetchQuery({
      queryKey: key,
      queryFn: prefetchQueryFn,
      staleTime: 1000,
    })

    await vi.advanceTimersByTimeAsync(0)

    function Page() {
      useQuery({ queryKey: key, queryFn, staleTime: 1000 })
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)

    expect(prefetchQueryFn).toHaveBeenCalledTimes(1)
    expect(queryFn).toHaveBeenCalledTimes(0)
  })

  // See https://github.com/tannerlinsley/react-query/issues/190
  it('should reset failureCount on successful fetch', async () => {
    const key = queryKey()

    let counter = 0

    function Page() {
      const query = useQuery({
        queryKey: key,
        queryFn: () => {
          if (counter < 2) {
            counter++
            return Promise.reject(new Error('error'))
          } else {
            return Promise.resolve('data')
          }
        },
        retryDelay: 10,
      })

      return (
        <div>
          <div>failureCount {query.failureCount}</div>
          <div>failureReason {query.failureReason?.message ?? 'null'}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('failureCount 2')).toBeInTheDocument()
    expect(rendered.getByText('failureReason error')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('failureCount 0')).toBeInTheDocument()
    expect(rendered.getByText('failureReason null')).toBeInTheDocument()
  })

  // See https://github.com/tannerlinsley/react-query/issues/199
  it('should use prefetched data for dependent query', async () => {
    const key = queryKey()
    let count = 0

    function Page() {
      const [enabled, setEnabled] = React.useState(false)
      const [isPrefetched, setPrefetched] = React.useState(false)

      const query = useQuery({
        queryKey: key,
        queryFn: async () => {
          count++
          await sleep(10)
          return count
        },

        enabled,
      })

      React.useEffect(() => {
        async function prefetch() {
          await queryClient.prefetchQuery({
            queryKey: key,
            queryFn: () => Promise.resolve('prefetched data'),
          })
          act(() => setPrefetched(true))
        }

        prefetch()
      }, [])

      return (
        <div>
          {isPrefetched && <div>isPrefetched</div>}
          <button onClick={() => setEnabled(true)}>setKey</button>
          <div>data: {query.data}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('isPrefetched')).toBeInTheDocument()
    fireEvent.click(rendered.getByText('setKey'))
    expect(rendered.getByText('data: prefetched data')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('data: 1')).toBeInTheDocument()
    expect(count).toBe(1)
  })

  it('should support dependent queries via the enable config option', async () => {
    const key = queryKey()

    function Page() {
      const [shouldFetch, setShouldFetch] = React.useState(false)

      const query = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 'data'
        },
        enabled: shouldFetch,
      })

      return (
        <div>
          <div>FetchStatus: {query.fetchStatus}</div>
          <h2>Data: {query.data || 'no data'}</h2>
          {shouldFetch ? null : (
            <button onClick={() => setShouldFetch(true)}>fetch</button>
          )}
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    expect(rendered.getByText('FetchStatus: idle')).toBeInTheDocument()
    expect(rendered.getByText('Data: no data')).toBeInTheDocument()

    fireEvent.click(rendered.getByText('fetch'))

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('FetchStatus: fetching')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('FetchStatus: idle')).toBeInTheDocument()
    expect(rendered.getByText('Data: data')).toBeInTheDocument()
  })

  it('should mark query as fetching, when using initialData', async () => {
    const key = queryKey()
    const results: Array<DefinedUseQueryResult<string>> = []

    function Page() {
      const result = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 'serverData'
        },
        initialData: 'initialData',
      })
      results.push(result)
      return <div>data: {result.data}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    rendered.getByText('data: initialData')
    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: serverData')

    expect(results.length).toBe(2)
    expect(results[0]).toMatchObject({ data: 'initialData', isFetching: true })
    expect(results[1]).toMatchObject({ data: 'serverData', isFetching: false })
  })

  it('should initialize state properly, when initialData is falsy', async () => {
    const key = queryKey()
    const results: Array<DefinedUseQueryResult<number>> = []

    function Page() {
      const result = useQuery({
        queryKey: key,
        queryFn: () => 1,
        initialData: 0,
      })
      results.push(result)
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)

    expect(results.length).toBe(2)
    expect(results[0]).toMatchObject({ data: 0, isFetching: true })
    expect(results[1]).toMatchObject({ data: 1, isFetching: false })
  })

  it('should show the correct data when switching keys with initialData, placeholderData & staleTime', async () => {
    const key = queryKey()

    const ALL_TODOS = [
      { name: 'todo A', priority: 'high' },
      { name: 'todo B', priority: 'medium' },
    ]

    const initialTodos = ALL_TODOS

    function Page() {
      const [filter, setFilter] = React.useState('')
      const { data: todos } = useQuery({
        queryKey: [...key, filter],
        queryFn: () => {
          return Promise.resolve(
            ALL_TODOS.filter((todo) =>
              filter ? todo.priority === filter : true,
            ),
          )
        },
        initialData() {
          return filter === '' ? initialTodos : undefined
        },
        placeholderData: keepPreviousData,
        staleTime: 5000,
      })

      return (
        <div>
          Current Todos, filter: {filter || 'all'}
          <hr />
          <button onClick={() => setFilter('')}>All</button>
          <button onClick={() => setFilter('high')}>High</button>
          <ul>
            {(todos ?? []).map((todo) => (
              <li key={todo.name}>
                {todo.name} - {todo.priority}
              </li>
            ))}
          </ul>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    expect(rendered.getByText('Current Todos, filter: all')).toBeInTheDocument()

    fireEvent.click(rendered.getByRole('button', { name: /high/i }))
    await vi.advanceTimersByTimeAsync(0)
    expect(
      rendered.getByText('Current Todos, filter: high'),
    ).toBeInTheDocument()
    fireEvent.click(rendered.getByRole('button', { name: /all/i }))
    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('todo B - medium')).toBeInTheDocument()
  })

  // // See https://github.com/tannerlinsley/react-query/issues/214
  it('data should persist when enabled is changed to false', async () => {
    const key = queryKey()
    const results: Array<DefinedUseQueryResult<string>> = []

    function Page() {
      const [shouldFetch, setShouldFetch] = React.useState(true)

      const result = useQuery({
        queryKey: key,
        queryFn: () => 'fetched data',
        enabled: shouldFetch,
        initialData: shouldFetch ? 'initial' : 'initial falsy',
      })

      results.push(result)

      return (
        <div>
          <div>{result.data}</div>
          <div>{shouldFetch ? 'enabled' : 'disabled'}</div>
          <button
            onClick={() => {
              setShouldFetch(false)
            }}
          >
            enable
          </button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('fetched data')).toBeInTheDocument()
    expect(rendered.getByText('enabled')).toBeInTheDocument()

    fireEvent.click(rendered.getByRole('button', { name: /enable/i }))

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('fetched data')).toBeInTheDocument()
    expect(rendered.getByText('disabled')).toBeInTheDocument()

    expect(results.length).toBe(3)
    expect(results[0]).toMatchObject({ data: 'initial', isStale: true })
    expect(results[1]).toMatchObject({ data: 'fetched data', isStale: true })
    // disabled observers are not stale
    expect(results[2]).toMatchObject({ data: 'fetched data', isStale: false })
  })

  it('should support enabled:false in query object syntax', () => {
    const key = queryKey()
    const queryFn = vi.fn<(...args: Array<unknown>) => string>()
    queryFn.mockImplementation(() => 'data')

    function Page() {
      const { fetchStatus } = useQuery({
        queryKey: key,
        queryFn,
        enabled: false,
      })
      return <div>fetchStatus: {fetchStatus}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    expect(queryFn).not.toHaveBeenCalled()
    expect(queryCache.find({ queryKey: key })).not.toBeUndefined()
    expect(rendered.getByText('fetchStatus: idle')).toBeInTheDocument()
  })

  // See https://github.com/tannerlinsley/react-query/issues/360
  test('should init to status:pending, fetchStatus:idle when enabled is false', async () => {
    const key = queryKey()

    function Page() {
      const query = useQuery({
        queryKey: key,
        queryFn: () => 'data',
        enabled: false,
      })

      return (
        <div>
          <div>
            status: {query.status}, {query.fetchStatus}
          </div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('status: pending, idle')).toBeInTheDocument()
  })

  test('should not schedule garbage collection, if gcTimeout is set to `Infinity`', async () => {
    const key = queryKey()

    function Page() {
      const query = useQuery({
        queryKey: key,
        queryFn: () => 'fetched data',
        gcTime: Infinity,
      })
      return <div>{query.data}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('fetched data')
    const setTimeoutSpy = vi.spyOn(globalThis.window, 'setTimeout')

    rendered.unmount()

    expect(setTimeoutSpy).not.toHaveBeenCalled()
  })

  test('should schedule garbage collection, if gcTimeout is not set to infinity', async () => {
    const key = queryKey()

    function Page() {
      const query = useQuery({
        queryKey: key,
        queryFn: () => 'fetched data',
        gcTime: 1000 * 60 * 10, // 10 Minutes
      })
      return <div>{query.data}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('fetched data')

    const setTimeoutSpy = vi.spyOn(globalThis.window, 'setTimeout')

    rendered.unmount()

    expect(setTimeoutSpy).toHaveBeenLastCalledWith(
      expect.any(Function),
      1000 * 60 * 10,
    )
  })

  it('should not cause memo churn when data does not change', async () => {
    const key = queryKey()
    const queryFn = vi
      .fn<(...args: Array<unknown>) => string>()
      .mockReturnValue('data')
    const memoFn = vi.fn()

    function Page() {
      const result = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return (
            queryFn() || {
              data: {
                nested: true,
              },
            }
          )
        },
      })

      React.useMemo(() => {
        memoFn()
        return result.data
      }, [result.data])

      return (
        <div>
          <div>status {result.status}</div>
          <div>isFetching {result.isFetching ? 'true' : 'false'}</div>
          <button onClick={() => result.refetch()}>refetch</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('status pending')
    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('status success')
    fireEvent.click(rendered.getByText('refetch'))
    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('isFetching true')
    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('isFetching false')
    expect(queryFn).toHaveBeenCalledTimes(2)
    expect(memoFn).toHaveBeenCalledTimes(2)
  })

  it('should update data upon interval changes', async () => {
    const key = queryKey()
    let count = 0

    function Page() {
      const [int, setInt] = React.useState(200)
      const { data } = useQuery({
        queryKey: key,
        queryFn: () => count++,
        refetchInterval: int,
      })

      React.useEffect(() => {
        if (data === 2) {
          setInt(0)
        }
      }, [data])

      return <div>count: {data}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    // mount
    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('count: 0')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(201)
    expect(rendered.getByText('count: 1')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(201)
    expect(rendered.getByText('count: 2')).toBeInTheDocument()
  })

  it('should refetch in an interval depending on function result', async () => {
    const key = queryKey()
    let count = 0
    const states: Array<UseQueryResult<number>> = []

    function Page() {
      const queryInfo = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return count++
        },
        refetchInterval: ({ state: { data = 0 } }) => (data < 2 ? 10 : false),
      })

      states.push(queryInfo)

      return (
        <div>
          <h1>count: {queryInfo.data}</h1>
          <h2>status: {queryInfo.status}</h2>
          <h2>data: {queryInfo.data}</h2>
          <h2>refetch: {queryInfo.isRefetching}</h2>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(51)
    rendered.getByText('count: 2')

    expect(states.length).toEqual(6)

    expect(states).toMatchObject([
      {
        status: 'pending',
        isFetching: true,
        data: undefined,
      },
      {
        status: 'success',
        isFetching: false,
        data: 0,
      },
      {
        status: 'success',
        isFetching: true,
        data: 0,
      },
      {
        status: 'success',
        isFetching: false,
        data: 1,
      },
      {
        status: 'success',
        isFetching: true,
        data: 1,
      },
      {
        status: 'success',
        isFetching: false,
        data: 2,
      },
    ])
  })

  it('should not interval fetch with a refetchInterval of 0', async () => {
    const key = queryKey()
    const queryFn = vi.fn(() => 1)

    function Page() {
      const queryInfo = useQuery({
        queryKey: key,
        queryFn,
        refetchInterval: 0,
      })

      return <div>count: {queryInfo.data}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('count: 1')

    await vi.advanceTimersByTimeAsync(10) // extra sleep to make sure we're not re-fetching

    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it('should accept an empty string as query key', async () => {
    function Page() {
      const result = useQuery({
        queryKey: [''],
        queryFn: (ctx) => ctx.queryKey,
      })
      return <>{JSON.stringify(result.data)}</>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('')).toBeInTheDocument()
  })

  it('should accept an object as query key', async () => {
    function Page() {
      const result = useQuery({
        queryKey: [{ a: 'a' }],
        queryFn: (ctx) => ctx.queryKey,
      })
      return <>{JSON.stringify(result.data)}</>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('[{"a":"a"}]')).toBeInTheDocument()
  })

  it('should refetch if any query instance becomes enabled', async () => {
    const key = queryKey()

    const queryFn = vi
      .fn<(...args: Array<unknown>) => string>()
      .mockReturnValue('data')

    function Disabled() {
      useQuery({ queryKey: key, queryFn, enabled: false })
      return null
    }

    function Page() {
      const [enabled, setEnabled] = React.useState(false)
      const result = useQuery({ queryKey: key, queryFn, enabled })
      return (
        <>
          <Disabled />
          <div>{result.data}</div>
          <button onClick={() => setEnabled(true)}>enable</button>
        </>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)
    expect(queryFn).toHaveBeenCalledTimes(0)
    fireEvent.click(rendered.getByText('enable'))
    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('data')
    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it('should use placeholder data while the query loads', async () => {
    const key1 = queryKey()

    const states: Array<UseQueryResult<string>> = []

    function Page() {
      const state = useQuery({
        queryKey: key1,
        queryFn: () => 'data',
        placeholderData: 'placeholder',
      })

      states.push(state)

      return (
        <div>
          <h2>Data: {state.data}</h2>
          <div>Status: {state.status}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)
    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('Data: data')

    expect(states).toMatchObject([
      {
        isSuccess: true,
        isPlaceholderData: true,
        data: 'placeholder',
      },
      {
        isSuccess: true,
        isPlaceholderData: false,
        data: 'data',
      },
    ])
  })

  it('should use placeholder data even for disabled queries', async () => {
    const key1 = queryKey()

    const states: Array<{ state: UseQueryResult<string>; count: number }> = []

    function Page() {
      const [count, setCount] = React.useState(0)

      const state = useQuery({
        queryKey: key1,
        queryFn: () => 'data',
        placeholderData: 'placeholder',
        enabled: count === 0,
      })

      states.push({ state, count })

      React.useEffect(() => {
        setCount(1)
      }, [])

      return (
        <div>
          <h2>Data: {state.data}</h2>
          <div>Status: {state.status}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)
    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('Data: data')

    expect(states).toMatchObject([
      {
        state: {
          isSuccess: true,
          isPlaceholderData: true,
          data: 'placeholder',
        },
        count: 0,
      },
      {
        state: {
          isSuccess: true,
          isPlaceholderData: true,
          data: 'placeholder',
        },
        count: 1,
      },
      {
        state: {
          isSuccess: true,
          isPlaceholderData: false,
          data: 'data',
        },
        count: 1,
      },
    ])
  })

  it('placeholder data should run through select', async () => {
    const key1 = queryKey()

    const states: Array<UseQueryResult<string>> = []

    function Page() {
      const state = useQuery({
        queryKey: key1,
        queryFn: () => 1,
        placeholderData: 23,
        select: (data) => String(data * 2),
      })

      states.push(state)

      return (
        <div>
          <h2>Data: {state.data}</h2>
          <div>Status: {state.status}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)
    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('Data: 2')

    expect(states).toMatchObject([
      {
        isSuccess: true,
        isPlaceholderData: true,
        data: '46',
      },
      {
        isSuccess: true,
        isPlaceholderData: false,
        data: '2',
      },
    ])
  })

  it('placeholder data function result should run through select', async () => {
    const key1 = queryKey()

    const states: Array<UseQueryResult<string>> = []
    let placeholderFunctionRunCount = 0

    function Page() {
      const state = useQuery({
        queryKey: key1,
        queryFn: () => 1,
        placeholderData: () => {
          placeholderFunctionRunCount++
          return 23
        },
        select: (data) => String(data * 2),
      })

      states.push(state)

      return (
        <div>
          <h2>Data: {state.data}</h2>
          <div>Status: {state.status}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)
    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('Data: 2')

    rendered.rerender(<Page />)

    expect(states).toMatchObject([
      {
        isSuccess: true,
        isPlaceholderData: true,
        data: '46',
      },
      {
        isSuccess: true,
        isPlaceholderData: false,
        data: '2',
      },
      {
        isSuccess: true,
        isPlaceholderData: false,
        data: '2',
      },
    ])

    expect(placeholderFunctionRunCount).toEqual(1)
  })

  it('select should only run when dependencies change if memoized', async () => {
    const key1 = queryKey()

    let selectRun = 0

    function Page() {
      const [count, inc] = React.useReducer((prev) => prev + 1, 2)

      const state = useQuery({
        queryKey: key1,
        queryFn: async () => {
          await sleep(10)
          return 0
        },
        select: React.useCallback(
          (data: number) => {
            selectRun++
            return `selected ${data + count}`
          },
          [count],
        ),
        placeholderData: 99,
      })

      return (
        <div>
          <h2>Data: {state.data}</h2>
          <button onClick={inc}>inc: {count}</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)
    rendered.getByText('Data: selected 101') // 99 + 2
    expect(selectRun).toBe(1)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('Data: selected 2') // 0 + 2
    expect(selectRun).toBe(2)

    fireEvent.click(rendered.getByRole('button', { name: /inc/i }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('Data: selected 3') // 0 + 3
    expect(selectRun).toBe(3)
  })

  it('select should always return the correct state', async () => {
    const key1 = queryKey()

    function Page() {
      const [count, inc] = React.useReducer((prev) => prev + 1, 2)
      const [forceValue, forceUpdate] = React.useReducer((prev) => prev + 1, 1)

      const state = useQuery({
        queryKey: key1,
        queryFn: async () => {
          await sleep(10)
          return 0
        },

        select: React.useCallback(
          (data: number) => {
            return `selected ${data + count}`
          },
          [count],
        ),
        placeholderData: 99,
      })

      return (
        <div>
          <h2>Data: {state.data}</h2>
          <h2>forceValue: {forceValue}</h2>
          <button onClick={inc}>inc: {count}</button>
          <button onClick={forceUpdate}>forceUpdate</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    expect(rendered.getByText('Data: selected 101')).toBeInTheDocument() // 99 + 2

    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('Data: selected 2')).toBeInTheDocument() // 0 + 2

    fireEvent.click(rendered.getByRole('button', { name: /inc/i }))

    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('Data: selected 3')).toBeInTheDocument() // 0 + 3

    fireEvent.click(rendered.getByRole('button', { name: /forceUpdate/i }))

    expect(rendered.getByText('forceValue: 2')).toBeInTheDocument()
    // data should still be 3 after an independent re-render
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('Data: selected 3')).toBeInTheDocument()
  })

  it('select should structurally share data', async () => {
    const key1 = queryKey()
    const states: Array<Array<number>> = []

    function Page() {
      const [forceValue, forceUpdate] = React.useReducer((prev) => prev + 1, 1)

      const state = useQuery({
        queryKey: key1,
        queryFn: async () => {
          await sleep(10)
          return [1, 2]
        },

        select: (res) => res.map((x) => x + 1),
      })

      React.useEffect(() => {
        if (state.data) {
          states.push(state.data)
        }
      }, [state.data])

      return (
        <div>
          <h2>Data: {JSON.stringify(state.data)}</h2>
          <h2>forceValue: {forceValue}</h2>
          <button onClick={forceUpdate}>forceUpdate</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('Data: [2,3]')
    expect(states).toHaveLength(1)

    fireEvent.click(rendered.getByRole('button', { name: /forceUpdate/i }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('forceValue: 2')
    rendered.getByText('Data: [2,3]')

    // effect should not be triggered again due to structural sharing
    expect(states).toHaveLength(1)
  })

  it('should cancel the query function when there are no more subscriptions', async () => {
    const key = queryKey()
    let cancelFn: Mock = vi.fn()

    const queryFn = ({ signal }: { signal?: AbortSignal }) => {
      const promise = new Promise<string>((resolve, reject) => {
        cancelFn = vi.fn(() => reject('Cancelled'))
        signal?.addEventListener('abort', cancelFn)
        sleep(20).then(() => resolve('OK'))
      })

      return promise
    }

    function Page() {
      const state = useQuery({ queryKey: key, queryFn })
      return (
        <div>
          <h1>Status: {state.status}</h1>
        </div>
      )
    }

    const rendered = renderWithClient(
      queryClient,
      <Blink duration={5}>
        <Page />
      </Blink>,
    )

    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('off')

    expect(cancelFn).toHaveBeenCalled()
  })

  it('should cancel the query if the signal was consumed and there are no more subscriptions', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    const queryFn: QueryFunction<string, [typeof key, number]> = async (
      ctx,
    ) => {
      const [, limit] = ctx.queryKey
      const value = limit % 2 && ctx.signal ? 'abort' : `data ${limit}`
      await sleep(25)
      return value
    }

    function Page(props: { limit: number }) {
      const state = useQuery({ queryKey: [key, props.limit], queryFn })
      states[props.limit] = state
      return (
        <div>
          <h1>Status: {state.status}</h1>
          <h1>data: {state.data}</h1>
        </div>
      )
    }

    const rendered = renderWithClient(
      queryClient,
      <Blink duration={5}>
        <Page limit={0} />
        <Page limit={1} />
        <Page limit={2} />
        <Page limit={3} />
      </Blink>,
    )

    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('off')
    await vi.advanceTimersByTimeAsync(20)

    expect(states).toHaveLength(4)

    expect(queryCache.find({ queryKey: [key, 0] })?.state).toMatchObject({
      data: 'data 0',
      status: 'success',
      dataUpdateCount: 1,
    })

    expect(queryCache.find({ queryKey: [key, 1] })?.state).toMatchObject({
      data: undefined,
      status: 'pending',
      fetchStatus: 'idle',
    })

    expect(queryCache.find({ queryKey: [key, 2] })?.state).toMatchObject({
      data: 'data 2',
      status: 'success',
      dataUpdateCount: 1,
    })

    expect(queryCache.find({ queryKey: [key, 3] })?.state).toMatchObject({
      data: undefined,
      status: 'pending',
      fetchStatus: 'idle',
    })
  })

  it('should refetch when quickly switching to a failed query', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<string>> = []

    const queryFn = async () => {
      await sleep(50)
      return 'OK'
    }

    function Page() {
      const [id, setId] = React.useState(1)
      const [hasChanged, setHasChanged] = React.useState(false)

      const state = useQuery({ queryKey: [key, id], queryFn })

      states.push(state)

      React.useEffect(() => {
        setId((prevId) => (prevId === 1 ? 2 : 1))
        setHasChanged(true)
      }, [hasChanged])

      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(51)
    expect(states.length).toBe(4)
    // Load query 1
    expect(states[0]).toMatchObject({
      status: 'pending',
      error: null,
    })
    // Load query 2
    expect(states[1]).toMatchObject({
      status: 'pending',
      error: null,
    })
    // Load query 1
    expect(states[2]).toMatchObject({
      status: 'pending',
      error: null,
    })
    // Loaded query 1
    expect(states[3]).toMatchObject({
      status: 'success',
      error: null,
    })
  })

  it('should update query state and refetch when reset with resetQueries', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          count++
          return count
        },
        staleTime: Infinity,
      })

      states.push(state)

      return (
        <div>
          <button onClick={() => queryClient.resetQueries({ queryKey: key })}>
            reset
          </button>
          <div>data: {state.data ?? 'null'}</div>
          <div>isFetching: {state.isFetching}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1')
    fireEvent.click(rendered.getByRole('button', { name: /reset/i }))

    await vi.advanceTimersByTimeAsync(11)
    expect(states.length).toBe(4)
    rendered.getByText('data: 2')

    expect(count).toBe(2)

    expect(states[0]).toMatchObject({
      data: undefined,
      isPending: true,
      isFetching: true,
      isSuccess: false,
      isStale: true,
    })
    expect(states[1]).toMatchObject({
      data: 1,
      isPending: false,
      isFetching: false,
      isSuccess: true,
      isStale: false,
    })
    expect(states[2]).toMatchObject({
      data: undefined,
      isPending: true,
      isFetching: true,
      isSuccess: false,
      isStale: true,
    })
    expect(states[3]).toMatchObject({
      data: 2,
      isPending: false,
      isFetching: false,
      isSuccess: true,
      isStale: false,
    })
  })

  it('should update query state and not refetch when resetting a disabled query with resetQueries', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          count++
          return count
        },
        staleTime: Infinity,
        enabled: false,
        notifyOnChangeProps: 'all',
      })

      states.push(state)

      const { refetch } = state

      return (
        <div>
          <button onClick={() => refetch()}>refetch</button>
          <button onClick={() => queryClient.resetQueries({ queryKey: key })}>
            reset
          </button>
          <div>data: {state.data ?? 'null'}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    rendered.getByText('data: null')
    fireEvent.click(rendered.getByRole('button', { name: /refetch/i }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1')
    fireEvent.click(rendered.getByRole('button', { name: /reset/i }))

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('data: null')
    expect(states.length).toBe(4)

    expect(count).toBe(1)

    expect(states[0]).toMatchObject({
      data: undefined,
      isPending: true,
      isFetching: false,
      isSuccess: false,
      isStale: false,
    })
    expect(states[1]).toMatchObject({
      data: undefined,
      isPending: true,
      isFetching: true,
      isSuccess: false,
      isStale: false,
    })
    expect(states[2]).toMatchObject({
      data: 1,
      isPending: false,
      isFetching: false,
      isSuccess: true,
      isStale: false,
    })
    expect(states[3]).toMatchObject({
      data: undefined,
      isPending: true,
      isFetching: false,
      isSuccess: false,
      isStale: false,
    })
  })

  it('should only call the query hash function once each render', async () => {
    const key = queryKey()

    let hashes = 0
    let renders = 0

    function queryKeyHashFn(x: any) {
      hashes++
      return JSON.stringify(x)
    }

    function Page() {
      React.useEffect(() => {
        renders++
      })

      useQuery({ queryKey: key, queryFn: () => 'test', queryKeyHashFn })
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)

    expect(renders).toBe(hashes)
  })

  it('should hash query keys that contain bigints given a supported query hash function', async () => {
    const key = [queryKey(), 1n]

    function queryKeyHashFn(x: any) {
      return JSON.stringify(x, (_, value) => {
        if (typeof value === 'bigint') return value.toString()
        return value
      })
    }

    function Page() {
      useQuery({ queryKey: key, queryFn: () => 'test', queryKeyHashFn })
      return null
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)

    const query = queryClient.getQueryCache().get(queryKeyHashFn(key))
    expect(query?.state.data).toBe('test')
  })

  it('should refetch when changed enabled to true in error state', async () => {
    const queryFn = vi.fn<(...args: Array<unknown>) => unknown>()
    queryFn.mockImplementation(async () => {
      await sleep(10)
      return Promise.reject(new Error('Suspense Error Bingo'))
    })

    function Page({ enabled }: { enabled: boolean }) {
      const { error, isPending } = useQuery({
        queryKey: ['key'],
        queryFn,
        enabled,
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      })

      if (isPending) {
        return <div>status: pending</div>
      }
      if (error instanceof Error) {
        return <div>error</div>
      }
      return <div>rendered</div>
    }

    function App() {
      const [enabled, toggle] = React.useReducer((x) => !x, true)

      return (
        <div>
          <Page enabled={enabled} />
          <button aria-label="retry" onClick={toggle}>
            retry {enabled}
          </button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <App />)

    // initial state check
    rendered.getByText('status: pending')

    // // render error state component
    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('error')
    expect(queryFn).toBeCalledTimes(1)

    // change to enabled to false
    fireEvent.click(rendered.getByLabelText('retry'))
    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('error')
    expect(queryFn).toBeCalledTimes(1)

    // // change to enabled to true
    fireEvent.click(rendered.getByLabelText('retry'))
    expect(queryFn).toBeCalledTimes(2)
  })

  it('should refetch when query key changed when previous status is error', async () => {
    function Page({ id }: { id: number }) {
      const { error, isPending } = useQuery({
        queryKey: [id],
        queryFn: async () => {
          await sleep(10)
          if (id % 2 === 1) {
            return Promise.reject(new Error('Error'))
          } else {
            return 'data'
          }
        },
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      })

      if (isPending) {
        return <div>status: pending</div>
      }
      if (error instanceof Error) {
        return <div>error</div>
      }
      return <div>rendered</div>
    }

    function App() {
      const [id, changeId] = React.useReducer((x) => x + 1, 1)

      return (
        <div>
          <Page id={id} />
          <button aria-label="change" onClick={changeId}>
            change {id}
          </button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <App />)

    // initial state check
    expect(rendered.getByText('status: pending')).toBeInTheDocument()

    // render error state component
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('error')).toBeInTheDocument()

    // change to unmount query
    fireEvent.click(rendered.getByLabelText('change'))
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('rendered')).toBeInTheDocument()

    // change to mount new query
    fireEvent.click(rendered.getByLabelText('change'))
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('error')).toBeInTheDocument()
  })

  it('should refetch when query key changed when switching between erroneous queries', async () => {
    function Page({ id }: { id: boolean }) {
      const { error, isFetching } = useQuery({
        queryKey: [id],
        queryFn: async () => {
          await sleep(10)
          return Promise.reject<unknown>(new Error('Error'))
        },
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      })

      if (isFetching) {
        return <div>status: fetching</div>
      }
      if (error instanceof Error) {
        return <div>error</div>
      }
      return <div>rendered</div>
    }

    function App() {
      const [value, toggle] = React.useReducer((x) => !x, true)

      return (
        <div>
          <Page id={value} />
          <button aria-label="change" onClick={toggle}>
            change {value}
          </button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <App />)

    // initial state check
    expect(rendered.getByText('status: fetching')).toBeInTheDocument()

    // render error state component
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('error')).toBeInTheDocument()

    // change to mount second query
    fireEvent.click(rendered.getByLabelText('change'))
    expect(rendered.getByText('status: fetching')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('error')).toBeInTheDocument()

    // change to mount first query again
    fireEvent.click(rendered.getByLabelText('change'))
    expect(rendered.getByText('status: fetching')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('error')).toBeInTheDocument()
  })

  it('should have no error in pending state when refetching after error occurred', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number>> = []
    const error = new Error('oops')

    let count = 0

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          if (count === 0) {
            count++
            throw error
          }
          return 5
        },
        retry: false,
      })

      states.push(state)

      if (state.isPending) {
        return <div>status: pending</div>
      }
      if (state.error instanceof Error) {
        return (
          <div>
            <div>error</div>
            <button onClick={() => state.refetch()}>refetch</button>
          </div>
        )
      }
      return <div>data: {state.data}</div>
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('error')

    fireEvent.click(rendered.getByRole('button', { name: 'refetch' }))
    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 5')

    expect(states.length).toBe(4)

    expect(states[0]).toMatchObject({
      status: 'pending',
      data: undefined,
      error: null,
    })

    expect(states[1]).toMatchObject({
      status: 'error',
      data: undefined,
      error,
    })

    expect(states[2]).toMatchObject({
      status: 'pending',
      data: undefined,
      error: null,
    })

    expect(states[3]).toMatchObject({
      status: 'success',
      data: 5,
      error: null,
    })
  })

  describe('networkMode online', () => {
    it('online queries should not start fetching if you are offline', async () => {
      const onlineMock = mockOnlineManagerIsOnline(false)

      const key = queryKey()
      const states: Array<any> = []

      function Page() {
        const state = useQuery({
          queryKey: key,
          queryFn: async () => {
            await sleep(10)
            return 'data'
          },
        })

        React.useEffect(() => {
          states.push(state.fetchStatus)
        })

        return (
          <div>
            <div>
              status: {state.status}, isPaused: {String(state.isPaused)}
            </div>
            <div>data: {state.data}</div>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      rendered.getByText('status: pending, isPaused: true')

      onlineMock.mockReturnValue(true)
      queryClient.getQueryCache().onOnline()

      await vi.advanceTimersByTimeAsync(11)
      rendered.getByText('status: success, isPaused: false')
      expect(rendered.getByText('data: data')).toBeInTheDocument()

      expect(states).toEqual(['paused', 'fetching', 'idle'])
      onlineMock.mockRestore()
    })

    it('online queries should not refetch if you are offline', async () => {
      const key = queryKey()
      let count = 0

      function Page() {
        const state = useQuery<string, string>({
          queryKey: key,
          queryFn: async () => {
            count++
            await sleep(10)
            return 'data' + count
          },
        })

        return (
          <div>
            <div>
              status: {state.status}, fetchStatus: {state.fetchStatus},
              failureCount: {state.failureCount}
            </div>
            <div>failureReason: {state.failureReason ?? 'null'}</div>
            <div>data: {state.data}</div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: key })}
            >
              invalidate
            </button>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      await vi.advanceTimersByTimeAsync(11)
      rendered.getByText('data: data1')

      const onlineMock = mockOnlineManagerIsOnline(false)

      fireEvent.click(rendered.getByRole('button', { name: /invalidate/i }))

      await vi.advanceTimersByTimeAsync(11)
      rendered.getByText(
        'status: success, fetchStatus: paused, failureCount: 0',
      )
      rendered.getByText('failureReason: null')

      onlineMock.mockReturnValue(true)
      queryClient.getQueryCache().onOnline()

      await vi.advanceTimersByTimeAsync(0)
      rendered.getByText(
        'status: success, fetchStatus: fetching, failureCount: 0',
      )
      rendered.getByText('failureReason: null')
      await vi.advanceTimersByTimeAsync(11)
      rendered.getByText('status: success, fetchStatus: idle, failureCount: 0')
      rendered.getByText('failureReason: null')

      expect(rendered.getByText('data: data2')).toBeInTheDocument()

      onlineMock.mockRestore()
    })

    it('online queries should not refetch if you are offline and refocus', async () => {
      const key = queryKey()
      let count = 0

      function Page() {
        const state = useQuery({
          queryKey: key,
          queryFn: async () => {
            count++
            await sleep(10)
            return 'data' + count
          },
        })

        return (
          <div>
            <div>
              status: {state.status}, fetchStatus: {state.fetchStatus}
            </div>
            <div>data: {state.data}</div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: key })}
            >
              invalidate
            </button>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      await vi.advanceTimersByTimeAsync(11)
      rendered.getByText('data: data1')

      const onlineMock = mockOnlineManagerIsOnline(false)
      fireEvent.click(rendered.getByRole('button', { name: /invalidate/i }))

      await vi.advanceTimersByTimeAsync(0)
      rendered.getByText('status: success, fetchStatus: paused')

      window.dispatchEvent(new Event('visibilitychange'))

      await vi.advanceTimersByTimeAsync(11)
      expect(rendered.queryByText('data: data2')).not.toBeInTheDocument()
      expect(count).toBe(1)
      onlineMock.mockRestore()
    })

    it('online queries should not refetch while already paused', async () => {
      const key = queryKey()
      let count = 0

      function Page() {
        const state = useQuery({
          queryKey: key,
          queryFn: async () => {
            count++
            await sleep(10)
            return 'data' + count
          },
        })

        return (
          <div>
            <div>
              status: {state.status}, fetchStatus: {state.fetchStatus}
            </div>
            <div>data: {state.data}</div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: key })}
            >
              invalidate
            </button>
          </div>
        )
      }

      const onlineMock = mockOnlineManagerIsOnline(false)

      const rendered = renderWithClient(queryClient, <Page />)

      await vi.advanceTimersByTimeAsync(0)
      rendered.getByText('status: pending, fetchStatus: paused')

      fireEvent.click(rendered.getByRole('button', { name: /invalidate/i }))

      await vi.advanceTimersByTimeAsync(11)
      // invalidation should not trigger a refetch
      rendered.getByText('status: pending, fetchStatus: paused')

      expect(count).toBe(0)
      onlineMock.mockRestore()
    })

    it('online queries should not refetch while already paused if data is in the cache', async () => {
      const key = queryKey()
      let count = 0

      function Page() {
        const state = useQuery({
          queryKey: key,
          queryFn: async () => {
            count++
            await sleep(10)
            return 'data' + count
          },
          initialData: 'initial',
        })

        return (
          <div>
            <div>
              status: {state.status}, fetchStatus: {state.fetchStatus}
            </div>
            <div>data: {state.data}</div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: key })}
            >
              invalidate
            </button>
          </div>
        )
      }

      const onlineMock = mockOnlineManagerIsOnline(false)

      const rendered = renderWithClient(queryClient, <Page />)

      rendered.getByText('status: success, fetchStatus: paused')
      expect(rendered.getByText('data: initial')).toBeInTheDocument()

      fireEvent.click(rendered.getByRole('button', { name: /invalidate/i }))

      await vi.advanceTimersByTimeAsync(11)

      // invalidation should not trigger a refetch
      rendered.getByText('status: success, fetchStatus: paused')

      expect(count).toBe(0)
      onlineMock.mockRestore()
    })

    it('online queries should not get stuck in fetching state when pausing multiple times', async () => {
      const key = queryKey()
      let count = 0

      function Page() {
        const state = useQuery({
          queryKey: key,
          queryFn: async () => {
            count++
            await sleep(10)
            return 'data' + count
          },
          initialData: 'initial',
        })

        return (
          <div>
            <div>
              status: {state.status}, fetchStatus: {state.fetchStatus}
            </div>
            <div>data: {state.data}</div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: key })}
            >
              invalidate
            </button>
          </div>
        )
      }

      const onlineMock = mockOnlineManagerIsOnline(false)

      const rendered = renderWithClient(queryClient, <Page />)

      rendered.getByText('status: success, fetchStatus: paused')
      expect(rendered.getByText('data: initial')).toBeInTheDocument()

      // triggers one pause
      fireEvent.click(rendered.getByRole('button', { name: /invalidate/i }))

      await vi.advanceTimersByTimeAsync(11)
      rendered.getByText('status: success, fetchStatus: paused')

      // triggers a second pause
      act(() => {
        window.dispatchEvent(new Event('visibilitychange'))
      })

      onlineMock.mockReturnValue(true)
      queryClient.getQueryCache().onOnline()

      await vi.advanceTimersByTimeAsync(11)
      rendered.getByText('status: success, fetchStatus: idle')
      expect(rendered.getByText('data: data1')).toBeInTheDocument()

      expect(count).toBe(1)

      onlineMock.mockRestore()
    })

    it('online queries should pause retries if you are offline', async () => {
      const key = queryKey()
      let count = 0

      function Page() {
        const state = useQuery<unknown, Error>({
          queryKey: key,
          queryFn: async (): Promise<unknown> => {
            count++
            await sleep(10)
            throw new Error('failed' + count)
          },
          retry: 2,
          retryDelay: 10,
        })

        return (
          <div>
            <div>
              status: {state.status}, fetchStatus: {state.fetchStatus},
              failureCount: {state.failureCount}
            </div>
            <div>failureReason: {state.failureReason?.message ?? 'null'}</div>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      rendered.getByText(/status: pending, fetchStatus: fetching/i)

      const onlineMock = mockOnlineManagerIsOnline(false)

      await vi.advanceTimersByTimeAsync(31)

      rendered.getByText(
        'status: pending, fetchStatus: paused, failureCount: 1',
      )
      rendered.getByText('failureReason: failed1')

      expect(count).toBe(1)

      onlineMock.mockReturnValue(true)
      queryClient.getQueryCache().onOnline()

      await vi.advanceTimersByTimeAsync(31)
      rendered.getByText('status: error, fetchStatus: idle, failureCount: 3')
      rendered.getByText('failureReason: failed3')

      expect(count).toBe(3)

      onlineMock.mockRestore()
    })

    it('online queries should fetch if paused and we go online even if already unmounted (because not cancelled)', async () => {
      const key = queryKey()
      let count = 0

      function Component() {
        const state = useQuery({
          queryKey: key,
          queryFn: async () => {
            count++
            await sleep(10)
            return 'data' + count
          },
        })

        return (
          <div>
            <div>
              status: {state.status}, fetchStatus: {state.fetchStatus}
            </div>
            <div>data: {state.data}</div>
          </div>
        )
      }

      function Page() {
        const [show, setShow] = React.useState(true)

        return (
          <div>
            {show && <Component />}
            <button onClick={() => setShow(false)}>hide</button>
          </div>
        )
      }

      const onlineMock = mockOnlineManagerIsOnline(false)

      const rendered = renderWithClient(queryClient, <Page />)

      rendered.getByText('status: pending, fetchStatus: paused')

      fireEvent.click(rendered.getByRole('button', { name: /hide/i }))

      onlineMock.mockReturnValue(true)
      queryClient.getQueryCache().onOnline()

      await vi.advanceTimersByTimeAsync(11)
      expect(queryClient.getQueryState(key)).toMatchObject({
        fetchStatus: 'idle',
        status: 'success',
      })

      // give it a bit more time to make sure queryFn is not called again
      expect(count).toBe(1)

      onlineMock.mockRestore()
    })

    it('online queries should not fetch if paused and we go online when cancelled and no refetchOnReconnect', async () => {
      const key = queryKey()
      let count = 0

      function Page() {
        const state = useQuery({
          queryKey: key,
          queryFn: async () => {
            count++
            await sleep(10)
            return 'data' + count
          },
          refetchOnReconnect: false,
        })

        return (
          <div>
            <button
              onClick={() => queryClient.cancelQueries({ queryKey: key })}
            >
              cancel
            </button>
            <div>
              status: {state.status}, fetchStatus: {state.fetchStatus}
            </div>
            <div>data: {state.data}</div>
          </div>
        )
      }

      const onlineMock = mockOnlineManagerIsOnline(false)

      const rendered = renderWithClient(queryClient, <Page />)

      rendered.getByText('status: pending, fetchStatus: paused')

      fireEvent.click(rendered.getByRole('button', { name: /cancel/i }))

      await vi.advanceTimersByTimeAsync(11)
      rendered.getByText('status: pending, fetchStatus: idle')

      expect(count).toBe(0)

      onlineMock.mockReturnValue(true)
      queryClient.getQueryCache().onOnline()

      await vi.advanceTimersByTimeAsync(11)

      rendered.getByText('status: pending, fetchStatus: idle')

      expect(count).toBe(0)

      onlineMock.mockRestore()
    })

    it('online queries should not fetch if paused and we go online if already unmounted when signal consumed', async () => {
      const key = queryKey()
      let count = 0

      function Component() {
        const state = useQuery({
          queryKey: key,
          queryFn: async ({ signal: _signal }) => {
            count++
            await sleep(10)
            return `signal${count}`
          },
        })

        return (
          <div>
            <div>
              status: {state.status}, fetchStatus: {state.fetchStatus}
            </div>
            <div>data: {state.data}</div>
          </div>
        )
      }

      function Page() {
        const [show, setShow] = React.useState(true)

        return (
          <div>
            {show && <Component />}
            <button onClick={() => setShow(false)}>hide</button>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: key })}
            >
              invalidate
            </button>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      await vi.advanceTimersByTimeAsync(11)
      rendered.getByText('status: success, fetchStatus: idle')

      const onlineMock = mockOnlineManagerIsOnline(false)

      fireEvent.click(rendered.getByRole('button', { name: /invalidate/i }))

      await vi.advanceTimersByTimeAsync(0)
      rendered.getByText('status: success, fetchStatus: paused')

      fireEvent.click(rendered.getByRole('button', { name: /hide/i }))

      onlineMock.mockReturnValue(true)
      queryClient.getQueryCache().onOnline()

      await vi.advanceTimersByTimeAsync(11)

      expect(queryClient.getQueryState(key)).toMatchObject({
        fetchStatus: 'idle',
        status: 'success',
      })

      expect(count).toBe(1)

      onlineMock.mockRestore()
    })
  })

  describe('networkMode always', () => {
    it('always queries should start fetching even if you are offline', async () => {
      const onlineMock = mockOnlineManagerIsOnline(false)

      const key = queryKey()
      let count = 0

      function Page() {
        const state = useQuery({
          queryKey: key,
          queryFn: async () => {
            count++
            await sleep(10)
            return 'data ' + count
          },
          networkMode: 'always',
        })

        return (
          <div>
            <div>
              status: {state.status}, isPaused: {String(state.isPaused)}
            </div>
            <div>data: {state.data}</div>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      await vi.advanceTimersByTimeAsync(11)
      rendered.getByText('status: success, isPaused: false')
      expect(rendered.getByText('data: data 1')).toBeInTheDocument()

      onlineMock.mockRestore()
    })

    it('always queries should not pause retries', async () => {
      const onlineMock = mockOnlineManagerIsOnline(false)

      const key = queryKey()
      let count = 0

      function Page() {
        const state = useQuery({
          queryKey: key,
          queryFn: async (): Promise<unknown> => {
            count++
            await sleep(10)
            throw new Error('error ' + count)
          },
          networkMode: 'always',
          retry: 1,
          retryDelay: 5,
        })

        return (
          <div>
            <div>
              status: {state.status}, isPaused: {String(state.isPaused)}
            </div>
            <div>
              error: {state.error instanceof Error && state.error.message}
            </div>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      await vi.advanceTimersByTimeAsync(26)
      rendered.getByText('status: error, isPaused: false')
      expect(rendered.getByText('error: error 2')).toBeInTheDocument()

      expect(count).toBe(2)

      onlineMock.mockRestore()
    })
  })

  describe('networkMode offlineFirst', () => {
    it('offlineFirst queries should start fetching if you are offline, but pause retries', async () => {
      const onlineMock = mockOnlineManagerIsOnline(false)

      const key = queryKey()
      let count = 0

      function Page() {
        const state = useQuery<unknown, Error>({
          queryKey: key,
          queryFn: async (): Promise<unknown> => {
            count++
            await sleep(10)
            throw new Error('failed' + count)
          },
          retry: 2,
          retryDelay: 1,
          networkMode: 'offlineFirst',
        })

        return (
          <div>
            <div>
              status: {state.status}, fetchStatus: {state.fetchStatus},
              failureCount: {state.failureCount}
            </div>
            <div>failureReason: {state.failureReason?.message ?? 'null'}</div>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      await vi.advanceTimersByTimeAsync(12)
      rendered.getByText(
        'status: pending, fetchStatus: paused, failureCount: 1',
      )
      rendered.getByText('failureReason: failed1')

      expect(count).toBe(1)

      onlineMock.mockReturnValue(true)
      queryClient.getQueryCache().onOnline()

      await vi.advanceTimersByTimeAsync(22)
      rendered.getByText('status: error, fetchStatus: idle, failureCount: 3')
      rendered.getByText('failureReason: failed3')

      expect(count).toBe(3)
      onlineMock.mockRestore()
    })
  })

  describe('subscribed', () => {
    it('should be able to toggle subscribed', async () => {
      const key = queryKey()
      const queryFn = vi.fn(() => Promise.resolve('data'))
      function Page() {
        const [subscribed, setSubscribed] = React.useState(true)
        const { data } = useQuery({
          queryKey: key,
          queryFn,
          subscribed,
        })
        return (
          <div>
            <span>data: {data}</span>
            <button onClick={() => setSubscribed(!subscribed)}>toggle</button>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)
      await vi.advanceTimersByTimeAsync(0)
      rendered.getByText('data: data')

      expect(
        queryClient.getQueryCache().find({ queryKey: key })!.observers.length,
      ).toBe(1)

      fireEvent.click(rendered.getByRole('button', { name: 'toggle' }))

      expect(
        queryClient.getQueryCache().find({ queryKey: key })!.observers.length,
      ).toBe(0)

      expect(queryFn).toHaveBeenCalledTimes(1)

      fireEvent.click(rendered.getByRole('button', { name: 'toggle' }))

      // background refetch when we re-subscribe
      await vi.advanceTimersByTimeAsync(0)
      expect(queryFn).toHaveBeenCalledTimes(2)
      expect(
        queryClient.getQueryCache().find({ queryKey: key })!.observers.length,
      ).toBe(1)
    })

    it('should not be attached to the query when subscribed is false', async () => {
      const key = queryKey()
      const queryFn = vi.fn(() => Promise.resolve('data'))
      function Page() {
        const { data } = useQuery({
          queryKey: key,
          queryFn,
          subscribed: false,
        })
        return (
          <div>
            <span>data: {data}</span>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      await vi.advanceTimersByTimeAsync(0)
      rendered.getByText('data:')

      expect(
        queryClient.getQueryCache().find({ queryKey: key })!.observers.length,
      ).toBe(0)

      expect(queryFn).toHaveBeenCalledTimes(0)
    })

    it('should not re-render when data is added to the cache when subscribed is false', async () => {
      const key = queryKey()
      let renders = 0
      function Page() {
        const { data } = useQuery({
          queryKey: key,
          queryFn: () => Promise.resolve('data'),
          subscribed: false,
        })
        renders++
        return (
          <div>
            <span>{data ? 'has data' + data : 'no data'}</span>
            <button
              onClick={() => queryClient.setQueryData<string>(key, 'new data')}
            >
              set data
            </button>
          </div>
        )
      }

      const rendered = renderWithClient(queryClient, <Page />)

      await vi.advanceTimersByTimeAsync(0)
      rendered.getByText('no data')

      fireEvent.click(rendered.getByRole('button', { name: 'set data' }))

      await vi.advanceTimersByTimeAsync(0)
      rendered.getByText('no data')

      expect(renders).toBe(1)
    })
  })

  it('should have status=error on mount when a query has failed', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<unknown>> = []
    const error = new Error('oops')

    const queryFn = (): Promise<unknown> => {
      return Promise.reject(error)
    }

    function Page() {
      const state = useQuery({
        queryKey: key,
        queryFn,
        retry: false,
        retryOnMount: false,
      })

      states.push(state)

      return <></>
    }

    await queryClient.prefetchQuery({ queryKey: key, queryFn })
    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(states).toHaveLength(1)

    expect(states[0]).toMatchObject({
      status: 'error',
      error,
    })
  })

  it('setQueryData - should respect updatedAt', async () => {
    const key = queryKey()

    function Page() {
      const state = useQuery({ queryKey: key, queryFn: () => 'data' })
      return (
        <div>
          <div>data: {state.data}</div>
          <div>dataUpdatedAt: {state.dataUpdatedAt}</div>
          <button
            onClick={() => {
              queryClient.setQueryData(key, 'newData', {
                updatedAt: 100,
              })
            }}
          >
            setQueryData
          </button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('data: data')
    fireEvent.click(rendered.getByRole('button', { name: /setQueryData/i }))
    await vi.advanceTimersByTimeAsync(0)
    rendered.getByText('data: newData')
    expect(rendered.getByText('dataUpdatedAt: 100')).toBeInTheDocument()
  })

  it('errorUpdateCount should increased on each fetch failure', async () => {
    const key = queryKey()
    const error = new Error('oops')

    function Page() {
      const { refetch, errorUpdateCount } = useQuery({
        queryKey: key,
        queryFn: (): Promise<unknown> => {
          return Promise.reject(error)
        },
        retry: false,
      })
      return (
        <div>
          <button onClick={() => refetch()}>refetch</button>
          <span>data: {errorUpdateCount}</span>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    const fetchBtn = rendered.getByRole('button', { name: 'refetch' })
    expect(rendered.getByText('data: 1')).toBeInTheDocument()
    fireEvent.click(fetchBtn)
    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('data: 2')).toBeInTheDocument()
    fireEvent.click(fetchBtn)
    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('data: 3')).toBeInTheDocument()
  })

  it('should use provided custom queryClient', async () => {
    const key = queryKey()
    const queryFn = async () => {
      return Promise.resolve('custom client')
    }

    function Page() {
      const { data } = useQuery(
        {
          queryKey: key,
          queryFn,
        },
        queryClient,
      )

      return <div>data: {data}</div>
    }

    const rendered = render(<Page></Page>)

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('data: custom client')).toBeInTheDocument()
  })

  it('should be notified of updates between create and subscribe', async () => {
    const key = queryKey()

    function Page() {
      const mounted = React.useRef<boolean>(false)
      const { data, status } = useQuery({
        enabled: false,
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return 5
        },
      })

      // this simulates a synchronous update between the time the query is created
      // and the time it is subscribed to that could be missed otherwise
      if (!mounted.current) {
        mounted.current = true
        queryClient.setQueryData(key, 1)
      }

      return (
        <div>
          <span>status: {status}</span>
          <span>data: {data}</span>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('status: success')).toBeInTheDocument()
    expect(rendered.getByText('data: 1')).toBeInTheDocument()
  })
  it('should reuse same data object reference when queryKey changes back to some cached data', async () => {
    const key = queryKey()
    const spy = vi.fn()

    async function fetchNumber(id: number) {
      await sleep(5)
      return { numbers: { current: { id } } }
    }
    function Test() {
      const [id, setId] = React.useState(1)

      const { data } = useQuery({
        select: selector,
        queryKey: [key, 'user', id],
        queryFn: () => fetchNumber(id),
      })

      React.useEffect(() => {
        spy(data)
      }, [data])

      return (
        <div>
          <button name="1" onClick={() => setId(1)}>
            1
          </button>
          <button name="2" onClick={() => setId(2)}>
            2
          </button>
          <span>Rendered Id: {data?.id}</span>
        </div>
      )
    }

    function selector(data: any) {
      return data.numbers.current
    }

    const rendered = renderWithClient(queryClient, <Test />)
    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockClear()
    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('Rendered Id: 1')
    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockClear()
    fireEvent.click(rendered.getByRole('button', { name: /2/ }))
    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('Rendered Id: 2')
    expect(spy).toHaveBeenCalledTimes(2) // called with undefined because id changed

    spy.mockClear()
    fireEvent.click(rendered.getByRole('button', { name: /1/ }))
    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('Rendered Id: 1')
    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockClear()
    fireEvent.click(rendered.getByRole('button', { name: /2/ }))
    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('Rendered Id: 2')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should reuse same data object reference when queryKey changes and placeholderData is present', async () => {
    const key = queryKey()
    const spy = vi.fn()

    async function fetchNumber(id: number) {
      await sleep(5)
      return { numbers: { current: { id } } }
    }
    function Test() {
      const [id, setId] = React.useState(1)

      const { data } = useQuery({
        select: selector,
        queryKey: [key, 'user', id],
        queryFn: () => fetchNumber(id),
        placeholderData: { numbers: { current: { id: 99 } } },
      })

      React.useEffect(() => {
        spy(data)
      }, [data])

      return (
        <div>
          <button name="1" onClick={() => setId(1)}>
            1
          </button>
          <button name="2" onClick={() => setId(2)}>
            2
          </button>
          <span>Rendered Id: {data?.id}</span>
        </div>
      )
    }

    function selector(data: any) {
      return data.numbers.current
    }

    const rendered = renderWithClient(queryClient, <Test />)
    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockClear()
    rendered.getByText('Rendered Id: 99')
    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('Rendered Id: 1')
    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockClear()
    fireEvent.click(rendered.getByRole('button', { name: /2/ }))
    rendered.getByText('Rendered Id: 99')
    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('Rendered Id: 2')
    expect(spy).toHaveBeenCalledTimes(2) // called with undefined because id changed

    spy.mockClear()
    fireEvent.click(rendered.getByRole('button', { name: /1/ }))
    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('Rendered Id: 1')
    expect(spy).toHaveBeenCalledTimes(1)

    spy.mockClear()
    fireEvent.click(rendered.getByRole('button', { name: /2/ }))
    await vi.advanceTimersByTimeAsync(6)
    rendered.getByText('Rendered Id: 2')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('should not cause an infinite render loop when using unstable callback ref', async () => {
    const key = queryKey()

    function Test() {
      const [_, setRef] = React.useState<HTMLDivElement | null>()

      const { data } = useQuery({
        queryKey: [key],
        queryFn: async () => {
          await sleep(5)
          return 'Works'
        },
      })

      return <div ref={(value) => setRef(value)}>{data}</div>
    }

    const rendered = renderWithClient(queryClient, <Test />)

    await vi.advanceTimersByTimeAsync(6)
    expect(rendered.getByText('Works')).toBeInTheDocument()
  })

  it('should keep the previous data when placeholderData is set and cache is used', async () => {
    const key = queryKey()
    const states: Array<UseQueryResult<number | undefined>> = []
    const steps = [0, 1, 0, 2]

    function Page() {
      const [count, setCount] = React.useState(0)

      const state = useQuery({
        staleTime: Infinity,
        queryKey: [key, steps[count]],
        queryFn: async () => {
          await sleep(10)
          return steps[count]
        },
        placeholderData: keepPreviousData,
      })

      states.push(state)

      return (
        <div>
          <div>data: {state.data}</div>
          <button onClick={() => setCount((c) => c + 1)}>setCount</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 0')

    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 1')

    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 0')

    fireEvent.click(rendered.getByRole('button', { name: 'setCount' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: 2')

    // Initial
    expect(states[0]).toMatchObject({
      data: undefined,
      isFetching: true,
      isSuccess: false,
      isPlaceholderData: false,
    })
    // Fetched
    expect(states[1]).toMatchObject({
      data: 0,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
    // Set state
    expect(states[2]).toMatchObject({
      data: 0,
      isFetching: true,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // New data
    expect(states[3]).toMatchObject({
      data: 1,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
    // Set state with existing data
    expect(states[4]).toMatchObject({
      data: 0,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
    // Set state where the placeholder value should come from cache request
    expect(states[5]).toMatchObject({
      data: 0,
      isFetching: true,
      isSuccess: true,
      isPlaceholderData: true,
    })
    // New data
    expect(states[6]).toMatchObject({
      data: 2,
      isFetching: false,
      isSuccess: true,
      isPlaceholderData: false,
    })
  })

  // For Project without TS, when migrating from v4 to v5, make sure invalid calls due to bad parameters are tracked.
  it('should throw in case of bad arguments to enhance DevX', () => {
    // Mock console error to avoid noise when test is run
    const consoleMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    const key = queryKey()
    const queryFn = () => 'data'

    function Page() {
      // Invalid call on purpose
      // @ts-expect-error
      useQuery(key, { queryFn })
      return <div>Does not matter</div>
    }

    expect(() => render(<Page />)).toThrow('Bad argument type')
    consoleMock.mockRestore()
  })

  it('should respect skipToken and refetch when skipToken is taken away', async () => {
    const key = queryKey()

    function Page({ enabled }: { enabled: boolean }) {
      const { data, status } = useQuery({
        queryKey: [key],
        queryFn: enabled
          ? async () => {
              await sleep(10)

              return Promise.resolve('data')
            }
          : skipToken,
        retry: false,
        retryOnMount: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
      })

      return (
        <div>
          <div>status: {status}</div>
          <div>data: {String(data)}</div>
        </div>
      )
    }

    function App() {
      const [enabled, toggle] = React.useReducer((x) => !x, false)

      return (
        <div>
          <Page enabled={enabled} />
          <button onClick={toggle}>enable</button>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <App />)

    expect(rendered.getByText('status: pending')).toBeInTheDocument()

    fireEvent.click(rendered.getByRole('button', { name: 'enable' }))
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('status: success')).toBeInTheDocument()
    expect(rendered.getByText('data: data')).toBeInTheDocument()
  })

  it('should allow enabled: true and queryFn: skipToken', () => {
    const consoleMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const key = queryKey()

    function App() {
      const query = useQuery({
        queryKey: key,
        queryFn: skipToken,
        enabled: true,
      })

      return (
        <div>
          <div>
            status: {query.status}, fetchStatus: {query.fetchStatus}
          </div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <App />)

    rendered.getByText('status: pending, fetchStatus: idle')

    // no warnings expected about skipToken / missing queryFn
    expect(consoleMock).toHaveBeenCalledTimes(0)
    consoleMock.mockRestore()
  })

  it('should return correct optimistic result when fetching after error', async () => {
    const key = queryKey()
    const error = new Error('oh no')

    const results: Array<UseQueryResult<string>> = []

    function Page() {
      const query = useQuery({
        queryKey: key,
        queryFn: async () => {
          await sleep(10)
          return Promise.reject(error)
        },
        retry: false,
        notifyOnChangeProps: 'all',
      })

      results.push(query)

      return (
        <div>
          <div>
            status: {query.status}, {query.fetchStatus}
          </div>
          <div>error: {query.error?.message}</div>
        </div>
      )
    }

    function App() {
      const [enabled, setEnabled] = React.useState(true)

      return (
        <div>
          <button onClick={() => setEnabled(!enabled)}>toggle</button>
          {enabled && <Page />}
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <App />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('status: error, idle')

    fireEvent.click(rendered.getByRole('button', { name: 'toggle' }))
    fireEvent.click(rendered.getByRole('button', { name: 'toggle' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('status: error, idle')

    expect(results).toHaveLength(4)

    // initial fetch
    expect(results[0]).toMatchObject({
      status: 'pending',
      fetchStatus: 'fetching',
      error: null,
      errorUpdatedAt: 0,
      errorUpdateCount: 0,
      isLoading: true,
      failureCount: 0,
      failureReason: null,
    })

    // error state
    expect(results[1]).toMatchObject({
      status: 'error',
      fetchStatus: 'idle',
      error,
      errorUpdateCount: 1,
      isLoading: false,
      failureCount: 1,
      failureReason: error,
    })
    expect(results[1]?.errorUpdatedAt).toBeGreaterThan(0)

    // refetch, optimistic state, no errors anymore
    expect(results[2]).toMatchObject({
      status: 'pending',
      fetchStatus: 'fetching',
      error: null,
      errorUpdateCount: 1,
      isLoading: true,
      failureCount: 0,
      failureReason: null,
    })
    expect(results[2]?.errorUpdatedAt).toBeGreaterThan(0)

    // final state
    expect(results[3]).toMatchObject({
      status: 'error',
      fetchStatus: 'idle',
      error: error,
      errorUpdateCount: 2,
      isLoading: false,
      failureCount: 1,
      failureReason: error,
    })
    expect(results[3]?.errorUpdatedAt).toBeGreaterThan(0)
  })

  it('should pick up an initialPromise', async () => {
    const key = queryKey()

    const serverQueryClient = new QueryClient({
      defaultOptions: { dehydrate: { shouldDehydrateQuery: () => true } },
    })

    void serverQueryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        await sleep(10)
        return Promise.resolve('server')
      },
    })

    const dehydrated = dehydrate(serverQueryClient)

    let count = 0

    function Page() {
      const query = useQuery({
        queryKey: key,
        queryFn: async () => {
          count++
          await sleep(10)
          return Promise.resolve('client')
        },
      })

      return (
        <div>
          <div>data: {query.data}</div>
          <button onClick={() => query.refetch()}>refetch</button>
        </div>
      )
    }

    const clientQueryClient = new QueryClient()
    hydrate(clientQueryClient, dehydrated)

    const rendered = renderWithClient(clientQueryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: server')
    expect(count).toBe(0)

    fireEvent.click(rendered.getByRole('button', { name: 'refetch' }))

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('data: client')
    expect(count).toBe(1)
  })

  it('should retry failed initialPromise on the client', async () => {
    const consoleMock = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const key = queryKey()

    const serverQueryClient = new QueryClient({
      defaultOptions: {
        dehydrate: { shouldDehydrateQuery: () => true },
      },
    })

    void serverQueryClient.prefetchQuery({
      queryKey: key,
      queryFn: async () => {
        await sleep(10)
        return Promise.reject(new Error('server error'))
      },
    })

    const dehydrated = dehydrate(serverQueryClient)

    let count = 0

    function Page() {
      const query = useQuery({
        queryKey: key,
        queryFn: async () => {
          count++
          await sleep(10)
          return Promise.resolve('client')
        },
      })

      return (
        <div>
          <div>failure: {query.failureReason?.message}</div>
          <div>data: {query.data}</div>
        </div>
      )
    }

    const clientQueryClient = new QueryClient({
      defaultOptions: { hydrate: { queries: { retry: 1, retryDelay: 10 } } },
    })
    hydrate(clientQueryClient, dehydrated)

    const rendered = renderWithClient(clientQueryClient, <Page />)

    await vi.advanceTimersByTimeAsync(11)
    rendered.getByText('failure: redacted')
    await vi.advanceTimersByTimeAsync(21)
    rendered.getByText('data: client')
    expect(count).toBe(1)

    const query = clientQueryClient.getQueryCache().find({ queryKey: key })

    expect(consoleMock).toHaveBeenCalledTimes(1)
    expect(consoleMock).toHaveBeenCalledWith(
      `A query that was dehydrated as pending ended up rejecting. [${query?.queryHash}]: Error: server error; The error will be redacted in production builds`,
    )

    consoleMock.mockRestore()
  })

  it('should console.error when there is no queryFn', () => {
    const consoleErrorMock = vi.spyOn(console, 'error')
    const key = queryKey()
    function Example() {
      useQuery({ queryKey: key })
      return <></>
    }
    renderWithClient(queryClient, <Example />)

    expect(consoleErrorMock).toHaveBeenCalledTimes(1)
    expect(consoleErrorMock).toHaveBeenCalledWith(
      `[${queryClient.getQueryCache().find({ queryKey: key })?.queryHash}]: No queryFn was passed as an option, and no default queryFn was found. The queryFn parameter is only optional when using a default queryFn. More info here: https://tanstack.com/query/latest/docs/framework/react/guides/default-query-function`,
    )

    consoleErrorMock.mockRestore()
  })
})
