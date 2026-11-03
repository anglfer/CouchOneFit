import { invalidInput, payload, uuid } from '../../auth/validators/lifecycle.js'

export function pageInput(query: Record<string, unknown>) {
  const page = query.page === undefined ? 1 : Number(query.page)
  const pageSize = query.pageSize === undefined ? 20 : Number(query.pageSize)
  const search =
    query.search === undefined
      ? ''
      : typeof query.search === 'string'
        ? query.search.trim()
        : invalidInput()
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1000000 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100 ||
    search.length > 150
  )
    return invalidInput()
  return { page, pageSize, search }
}
export function viewInput(clientId: string, body: unknown) {
  const data = payload(body, ['reason'])
  const reason = typeof data.reason === 'string' ? data.reason.trim() : ''
  if (reason.length < 3 || reason.length > 200)
    return invalidInput('Indica el motivo de la consulta (3 a 200 caracteres).')
  return { clientId: uuid(clientId), reason }
}
