import type { PaymentAdapterModule } from './types';

export type PaymentAdapterRegistration = {
  load: () => Promise<PaymentAdapterModule>;
  /**
   * `offline` providers (cash, Zelle, card reader at the chair) have no processor:
   * they can open a pending session, but capture, refund and status checks never
   * run through them. Money taken in person is recorded at checkout.
   */
  settlement: 'offline' | 'processor';
  allowsPublicSettlement: boolean;
};

// Provider execution is code-owned. Database values may select only one of these
// keys; they can never supply an import path, URL, or secret.
export const paymentProviderAdapters = {
  manual: {
    load: () => import('./manual') as Promise<PaymentAdapterModule>,
    settlement: 'offline',
    allowsPublicSettlement: false,
  },
  // Online deposits through Stripe Checkout. Secret key: STRIPE_SECRET_KEY.
  stripe: {
    load: () => import('./stripe') as Promise<PaymentAdapterModule>,
    settlement: 'processor',
    allowsPublicSettlement: true,
  },
} as const satisfies Record<string, PaymentAdapterRegistration>;

export type PaymentProviderAdapterCode = keyof typeof paymentProviderAdapters;

export function isPaymentProviderAdapterCode(value: string): value is PaymentProviderAdapterCode {
  return Object.prototype.hasOwnProperty.call(paymentProviderAdapters, value);
}

export function getPaymentProviderRegistration(code: string): PaymentAdapterRegistration | null {
  return isPaymentProviderAdapterCode(code) ? paymentProviderAdapters[code] : null;
}
