// ============================================================
//  FutBuddies - Stripe Frontend Loader
// ============================================================
import { loadStripe } from '@stripe/stripe-js';

const KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || '';

let _p = null;
export function getStripePromise() {
  if (!KEY) return null;
  if (!_p) _p = loadStripe(KEY);
  return _p;
}

export const stripeAtivo = () => !!KEY;
