import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import * as React from 'react'
import { queryKey, sleep } from '@tanstack/query-test-utils'
import { QueryCache, QueryClient, useIsFetching, useQuery } from '..'
import { renderWithClient, setActTimeout } from './utils'

describe('useIsFetching', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // See https://github.com/tannerlinsley/react-query/issues/105
  it('should update as queries start and stop fetching', async () => {
    const queryCache = new QueryCache()
    const queryClient = new QueryClient({ queryCache })
    const key = queryKey()

    function IsFetching() {
      const isFetching = useIsFetching()
      return <div>isFetching: {isFetching}</div>
    }

    function Query() {
      const [ready, setReady] = React.useState(false)

      useQuery({
        queryKey: key,
        queryFn: () => sleep(50).then(() => 'test'),
        enabled: ready,
      })

      return <button onClick={() => setReady(true)}>setReady</button>
    }

    function Page() {
      return (
        <div>
          <IsFetching />
          <Query />
        </div>
      )
    }

    const { getByText, getByRole } = renderWithClient(queryClient, <Page />)

    expect(getByText('isFetching: 0')).toBeInTheDocument()

    fireEvent.click(getByRole('button', { name: /setReady/i }))
    await vi.advanceTimersByTimeAsync(0)
    expect(getByText('isFetching: 1')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(51)
    expect(getByText('isFetching: 0')).toBeInTheDocument()
  })

  it('should not update state while rendering', async () => {
    const queryCache = new QueryCache()
    const queryClient = new QueryClient({ queryCache })

    const key1 = queryKey()
    const key2 = queryKey()

    const isFetchingArray: Array<number> = []

    function IsFetching() {
      const isFetching = useIsFetching()
      isFetchingArray.push(isFetching)
      return null
    }

    function FirstQuery() {
      useQuery({
        queryKey: key1,
        queryFn: () => sleep(100).then(() => 'data'),
      })
      return null
    }

    function SecondQuery() {
      useQuery({
        queryKey: key2,
        queryFn: () => sleep(100).then(() => 'data'),
      })
      return null
    }

    function Page() {
      const [renderSecond, setRenderSecond] = React.useState(false)

      React.useEffect(() => {
        setActTimeout(() => {
          setRenderSecond(true)
        }, 50)
      }, [])

      return (
        <>
          <IsFetching />
          <FirstQuery />
          {renderSecond && <SecondQuery />}
        </>
      )
    }

    renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(151)
    expect(isFetchingArray).toEqual([0, 1, 1, 2, 1, 0])
  })

  it('should be able to filter', async () => {
    const queryClient = new QueryClient()
    const key1 = queryKey()
    const key2 = queryKey()

    const isFetchingArray: Array<number> = []

    function One() {
      useQuery({
        queryKey: key1,
        queryFn: () => sleep(10).then(() => 'test'),
      })
      return null
    }

    function Two() {
      useQuery({
        queryKey: key2,
        queryFn: () => sleep(20).then(() => 'test'),
      })
      return null
    }

    function Page() {
      const [started, setStarted] = React.useState(false)
      const isFetching = useIsFetching({ queryKey: key1 })

      isFetchingArray.push(isFetching)

      return (
        <div>
          <button onClick={() => setStarted(true)}>setStarted</button>
          <div>isFetching: {isFetching}</div>
          {started ? (
            <>
              <One />
              <Two />
            </>
          ) : null}
        </div>
      )
    }

    const { getByText, getByRole } = renderWithClient(queryClient, <Page />)

    expect(getByText('isFetching: 0')).toBeInTheDocument()

    fireEvent.click(getByRole('button', { name: /setStarted/i }))
    await vi.advanceTimersByTimeAsync(0)
    expect(getByText('isFetching: 1')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(11)
    expect(getByText('isFetching: 0')).toBeInTheDocument()

    // at no point should we have isFetching: 2
    expect(isFetchingArray).toEqual(expect.not.arrayContaining([2]))
  })

  it('should show the correct fetching state when mounted after a query', async () => {
    const queryClient = new QueryClient()
    const key = queryKey()

    function Page() {
      useQuery({
        queryKey: key,
        queryFn: () => sleep(10).then(() => 'test'),
      })

      const isFetching = useIsFetching()

      return (
        <div>
          <div>isFetching: {isFetching}</div>
        </div>
      )
    }

    const rendered = renderWithClient(queryClient, <Page />)

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('isFetching: 1')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(11)
    expect(rendered.getByText('isFetching: 0')).toBeInTheDocument()
  })

  it('should use provided custom queryClient', async () => {
    const queryClient = new QueryClient()
    const key = queryKey()

    function Page() {
      useQuery(
        {
          queryKey: key,
          queryFn: () => sleep(10).then(() => 'test'),
        },
        queryClient,
      )

      const isFetching = useIsFetching({}, queryClient)

      return (
        <div>
          <div>isFetching: {isFetching}</div>
        </div>
      )
    }

    const rendered = render(<Page></Page>)

    await vi.advanceTimersByTimeAsync(0)
    expect(rendered.getByText('isFetching: 1')).toBeInTheDocument()
  })
})
