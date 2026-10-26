import { invalidInput } from '../../auth/validators/lifecycle.js'
export function directoryInput(input: Record<string, unknown>) {
  const page = input.page === undefined ? 1 : Number(input.page)
  const pageSize = input.pageSize === undefined ? 20 : Number(input.pageSize)
  const search =
    input.search === undefined
      ? ''
      : typeof input.search === 'string'
        ? input.search.trim()
        : invalidInput()
  const status = input.status === undefined ? '' : input.status
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1000000 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    search.length > 150 ||
    !['', 'active', 'suspended', 'expired', 'none'].includes(status as string)
  )
    return invalidInput()
  return { page, pageSize, search, status: status as string }
}
