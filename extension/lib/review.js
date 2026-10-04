// When to ask for a review. Pure functions: no storage, no network.
// Everything is counted on this device only and the rules are the same for
// everyone: nobody is filtered by how they feel, and nothing is offered in return.
import { REVIEW } from './constants.js';

export const emptyReview = (now = Date.now()) => ({ since: now, opens: 0, soft: 0, lastSoft: 0, asks: 0, lastAsk: 0, done: false });

// -> 'soft' (a quiet banner), 'ask' (the dialog) or null.
export function reviewPrompt(rv, now = Date.now()) {
  if (!rv || rv.done) return null;
  if (rv.opens < REVIEW.SOFT_AFTER_OPENS || now - rv.since < REVIEW.SOFT_AFTER_MS) return null;
  if (rv.soft < REVIEW.SOFT_MAX) return now - rv.lastSoft >= REVIEW.SOFT_GAP_MS ? 'soft' : null;
  // The quiet banner was shown (and ignored) the full number of times.
  if (rv.asks < REVIEW.ASK_MAX && rv.opens >= REVIEW.ASK_AFTER_OPENS && now - rv.since >= REVIEW.ASK_AFTER_MS
      && now - rv.lastAsk >= REVIEW.ASK_GAP_MS) return 'ask';
  return null;
}
