'use server'

import { confirmInvoiceByLink, payInvoiceByLink } from './public'
import { confirmInvoicePayment, payInvoice } from './account'

export async function startInvoicePayment(id: string, token?: string | null) {
  return token ? payInvoiceByLink(id, token) : payInvoice(id)
}

export async function confirmInvoice(id: string, token?: string | null) {
  return token ? confirmInvoiceByLink(id, token) : confirmInvoicePayment(id)
}
