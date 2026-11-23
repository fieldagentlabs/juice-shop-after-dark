/*
 * HTTP routes for the After Dark training features (see lib/afterDark.ts).
 */
import { type Request, type Response } from 'express'
import * as afterDark from '../lib/afterDark'

const loyalty = afterDark.createLoyalty()
const profiles = afterDark.createProfiles()

export function redeemLoyalty () {
  return async (req: Request, res: Response) => {
    const result = await loyalty.redeem(req.body?.account, req.body?.points)
    res.status(result.ok ? 200 : 400).json(result)
  }
}

export function downloadInvoice () {
  return (req: Request, res: Response) => {
    const { status, body } = afterDark.readInvoice(String(req.query.file ?? ''))
    res.status(status).type('text/plain').send(body)
  }
}

export function previewGiftCard () {
  return (req: Request, res: Response) => {
    const { recipient, amount, message } = req.body ?? {}
    res.json({ preview: afterDark.renderGiftCard(recipient, amount, message) })
  }
}

export function partnerToken () {
  return (_req: Request, res: Response) => {
    res.json({ token: afterDark.issueGuestToken() })
  }
}

export function partnerOrders () {
  return (req: Request, res: Response) => {
    const token = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    const { status, body } = afterDark.partnerOrders(token)
    res.status(status).json(body)
  }
}

export function showProfile () {
  return (req: Request, res: Response) => {
    res.json(profiles.show(req.params.id))
  }
}

export function updateProfile () {
  return (req: Request, res: Response) => {
    res.json(profiles.update(req.params.id, req.body ?? {}))
  }
}
