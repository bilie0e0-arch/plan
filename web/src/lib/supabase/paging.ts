/**
 * PostgREST caps every response at `max_rows` (1000), and long `in.(…)` lists overflow the URL limit.
 * These helpers make reads that can grow with time complete.
 */

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>

export const PAGE_SIZE = 1000

/** Fetch every page of an ordered query. `page(from, to)` must apply `.range(from, to)` to a stably ordered query. */
export async function fetchAll<T>(page: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error || !data) return out
    out.push(...data)
    if (data.length < PAGE_SIZE) return out
  }
}

export function chunks<T>(xs: T[], size = 100): T[][] {
  const out: T[][] = []
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size))
  return out
}
