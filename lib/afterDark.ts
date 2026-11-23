/*
 * Juice Shop After Dark: five training features for the Field Agents CTF.
 * Everything here is in memory. Nothing reads real files, runs code, or makes
 * network requests. A feature returns a proof token only when its planted
 * weakness is triggered; tokens come from AFTER_DARK_SECRET, set at startup.
 */
import crypto from 'node:crypto'
import path from 'node:path'

const secret = process.env.AFTER_DARK_SECRET ?? crypto.randomBytes(16).toString('hex')

export function proof (feature: string): string {
  return 'AD-' + crypto.createHmac('sha256', secret).update(feature).digest('hex').slice(0, 16)
}

const sleep = async (ms: number) => await new Promise(resolve => setTimeout(resolve, ms))

// Loyalty points: every demo account starts with 100 points.
export function createLoyalty (delayMs = 50) {
  const balances = new Map<string, number>()
  const redeemed = new Map<string, number>()
  return {
    async redeem (account: string, points: number) {
      const amount = Math.floor(Number(points))
      if (!account || !(amount > 0)) return { ok: false, error: 'account and a positive whole number of points are required' }
      const balance = balances.get(account) ?? 100
      if (amount > balance) return { ok: false, error: 'not enough points', balance }
      await sleep(delayMs) // look up the reward in the catalog
      balances.set(account, balance - amount)
      const total = (redeemed.get(account) ?? 0) + amount
      redeemed.set(account, total)
      const result: any = { ok: true, balance: balance - amount }
      if (total > 100) result.proof = proof('loyalty') // more points spent than the account ever had
      return result
    }
  }
}

// Invoices: a small virtual folder. Nothing outside it exists.
const files: Record<string, () => string> = {
  'invoices/INV-1001.txt': () => 'Invoice INV-1001\nApple Juice (1000ml) x2\nTotal 3.98\n',
  'invoices/INV-1002.txt': () => 'Invoice INV-1002\nBanana Juice (1000ml) x1\nTotal 1.99\n',
  'vault/proof.txt': () => proof('invoice') + '\n'
}

export function readInvoice (file: string) {
  if (!file || file.startsWith('/')) return { status: 400, body: 'file is required' }
  const resolved = path.posix.normalize(path.posix.join('invoices', file))
  if (resolved.startsWith('..')) return { status: 403, body: 'forbidden' }
  const read = files[resolved]
  return read ? { status: 200, body: read() } : { status: 404, body: 'not found' }
}

// Gift cards: {{ name }} placeholders are filled from the card's details.
export function renderGiftCard (recipient: string, amount: number, message: string) {
  const context: any = { recipient, amount, shop: 'OWASP Juice Shop', internal: { proofToken: proof('giftcard') } }
  return String(message ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => {
    const value = key.split('.').reduce((obj: any, part) => (obj != null ? obj[part] : undefined), context)
    return value === undefined || typeof value === 'object' ? '' : String(value)
  })
}

// Partner API: HS256 tokens signed with a key only the shop knows.
const partnerKey = crypto.randomBytes(32)
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url')

export function issueGuestToken (): string {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64(JSON.stringify({ sub: 'guest', role: 'guest' }))
  const sig = crypto.createHmac('sha256', partnerKey).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

export function verifyPartnerToken (token: string): any {
  const [h, p, s] = String(token ?? '').split('.')
  try {
    const header = JSON.parse(Buffer.from(h, 'base64url').toString())
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString())
    if (header.alg === 'none') return payload
    const expected = crypto.createHmac('sha256', partnerKey).update(`${h}.${p}`).digest('base64url')
    return s && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)) ? payload : null
  } catch {
    return null
  }
}

export function partnerOrders (token: string) {
  const claims = verifyPartnerToken(token)
  if (!claims) return { status: 401, body: { error: 'invalid token' } }
  if (claims.role !== 'partner') return { status: 403, body: { error: 'partners only' } }
  return { status: 200, body: { orders: [], proof: proof('partner') } }
}

// Profiles: customers can change their display name and bio.
export function createProfiles () {
  const profiles = new Map<string, any>()
  const get = (id: string) => {
    if (!profiles.has(id)) profiles.set(id, { id, displayName: `customer-${id}`, bio: '', tier: 'standard' })
    return profiles.get(id)
  }
  return {
    show (id: string) {
      const p = { ...get(id) }
      if (p.tier === 'diplomat') p.proof = proof('profile')
      return p
    },
    update (id: string, changes: any) {
      Object.assign(get(id), changes)
      return this.show(id)
    }
  }
}
