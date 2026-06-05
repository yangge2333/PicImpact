import { useEffect } from 'react'
import useSWR from 'swr'

const lastResolved = new Map<string, unknown>()

export const useSwrHydrated = <T = unknown>({ handle, args }: { handle: () => Promise<T>, args: string }) => {
  const { data, error, isLoading, isValidating, mutate } = useSWR(args,
    () => {
      return handle()
    }, { revalidateOnFocus: false, fallbackData: lastResolved.get(args) as T | undefined })

  useEffect(() => {
    if (data !== undefined) {
      lastResolved.set(args, data)
    }
  }, [args, data])

  return {
    data,
    error,
    isLoading: isLoading || isValidating,
    mutate
  }
}
