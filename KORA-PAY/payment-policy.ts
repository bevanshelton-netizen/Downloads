export type KoraPaymentStatus =
  | 'created'
  | 'pending'
  | 'authorised'
  | 'successful'
  | 'failed'
  | 'refunded'
  | 'disputed'
  | 'cancelled'
  | 'settled';

export interface KoraPayment {
  paymentId: string;
  amount: number;
  currency: string;
  status: KoraPaymentStatus;
  providerRef: string;
}

export interface PaymentPolicyResult {
  displayState: 'PENDING' | 'AVAILABLE' | 'FAILED' | 'REFUNDED' | 'DISPUTED' | 'CANCELLED';
  canFulfil: boolean;
  reason: string;
}

/** Keep payment initiation, success and settlement distinct. */
export function resolvePaymentPolicy(payment: KoraPayment): PaymentPolicyResult {
  if (!payment.providerRef) {
    return { displayState: 'FAILED', canFulfil: false, reason: 'No verified payment-provider reference.' };
  }

  switch (payment.status) {
    case 'successful':
    case 'settled':
      return { displayState: 'AVAILABLE', canFulfil: true, reason: 'Payment is confirmed for fulfilment.' };
    case 'pending':
    case 'created':
    case 'authorised':
      return { displayState: 'PENDING', canFulfil: false, reason: 'Payment is not yet confirmed for fulfilment.' };
    case 'refunded':
      return { displayState: 'REFUNDED', canFulfil: false, reason: 'Payment has been refunded.' };
    case 'disputed':
      return { displayState: 'DISPUTED', canFulfil: false, reason: 'Payment is under dispute.' };
    case 'cancelled':
      return { displayState: 'CANCELLED', canFulfil: false, reason: 'Payment was cancelled.' };
    case 'failed':
      return { displayState: 'FAILED', canFulfil: false, reason: 'Payment failed.' };
  }
}
