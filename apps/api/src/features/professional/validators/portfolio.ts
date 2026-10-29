import { createHmac, timingSafeEqual } from 'node:crypto'
import { jwtKey } from '../../auth/services/tokens.js'
import { invalidInput, payload } from '../../auth/validators/lifecycle.js'

export interface PortfolioQuery {
  search: string
  status: string
  pageSize: number
  after: { createdAt: string; id: string } | null
}
const signature = (value: string) =>
  createHmac('sha256', jwtKey())
    .update(`client-portfolio:v1:${value}`)
    .digest('base64url')

export function portfolioQuery(
  input: unknown,
  subject: string
): PortfolioQuery {
  const query = payload(input, ['search', 'status', 'pageSize', 'cursor'])
  const read = (key: string, fallback = '') => {
    if (query[key] === undefined) return fallback
    if (typeof query[key] !== 'string')
      return invalidInput('La consulta no es válida.')
    return query[key] as string
  }
  const search = read('search').trim()
  const status = read('status')
  const size = read('pageSize', '20')
  if (
    [...search].length > 150 ||
    search.includes('\u0000') ||
    !['', 'active', 'inactive'].includes(status) ||
    !/^[1-9][0-9]?$|^100$/.test(size)
  )
    return invalidInput('Los filtros no son válidos.')
  const pageSize = Number(size)
  const token = read('cursor')
  let after: PortfolioQuery['after'] = null
  if (token) {
    if (token.length > 4096 || !/^[\w-]+\.[\w-]+$/.test(token))
      return invalidInput('La página no es válida.')
    const [encoded, mac] = token.split('.')
    const expected = signature(encoded)
    if (
      mac.length !== expected.length ||
      !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
    )
      return invalidInput('La página no es válida.')
    try {
      const data = JSON.parse(
        Buffer.from(encoded, 'base64url').toString('utf8')
      )
      if (
        data.v !== 1 ||
        data.subject !== subject ||
        data.search !== search ||
        data.status !== status ||
        data.pageSize !== pageSize ||
        typeof data.createdAt !== 'string' ||
        typeof data.id !== 'string' ||
        !/^[0-9a-f-]{36}$/.test(data.id) ||
        !Number.isFinite(Date.parse(data.createdAt))
      )
        throw Error()
      after = { createdAt: data.createdAt, id: data.id }
    } catch {
      return invalidInput('La página no es válida.')
    }
  }
  return { search, status, pageSize, after }
}

export function portfolioCursor(
  subject: string,
  query: PortfolioQuery,
  createdAt: string,
  id: string
): string {
  const encoded = Buffer.from(
    JSON.stringify({
      v: 1,
      subject,
      search: query.search,
      status: query.status,
      pageSize: query.pageSize,
      createdAt,
      id
    })
  ).toString('base64url')
  return `${encoded}.${signature(encoded)}`
}
