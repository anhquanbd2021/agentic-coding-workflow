// The Loop Lab — fixture codebase.
//
// A virtual shop codebase modeled as data + behavior. Files carry facts that
// an agent can only learn by reading them (the "explore" phase). The agent's
// edit is then scored by the repo's own checks — the same checks a real test
// suite would run.

export const TASK = {
  title: '10% off orders of $100 or more',
  brief:
    'Add a discount: orders totalling $100 or more get 10% off. ' +
    'The cart and the invoice must agree, money math must be exact, ' +
    'and accounting requires every adjustment to appear as a line item.',
};

export const REPO_FILES = [
  {
    path: 'src/money.mjs',
    summary: 'Money helpers — every price is integer cents; pct() rounds to cents.',
    facts: ['integer-cents'],
  },
  {
    path: 'src/totals.mjs',
    summary: 'Single source of truth for order totals — called by BOTH cart and invoice.',
    facts: ['shared-totals'],
  },
  {
    path: 'src/invoice.mjs',
    summary: 'Renders invoice line items — accounting requires adjustments as lines.',
    facts: ['discount-as-line'],
  },
  {
    path: 'src/cart.mjs',
    summary: 'Cart page — renders the total by calling totals.mjs. No own math.',
    facts: [],
  },
  {
    path: 'test/totals.test.mjs',
    summary: 'Existing test suite — `npm test` exercises totals and invoice together.',
    facts: ['has-tests'],
  },
];

export const FACTS = {
  'integer-cents': {
    file: 'src/money.mjs',
    label: 'Money is integer cents',
    detail: 'Use the pct() helper — never float multiplication on money.',
  },
  'shared-totals': {
    file: 'src/totals.mjs',
    label: 'One shared totals function',
    detail: 'Cart and invoice both call totals.mjs — edit it once, not twice.',
  },
  'discount-as-line': {
    file: 'src/invoice.mjs',
    label: 'Adjustments are line items',
    detail: 'A discount must appear as an invoice line for the audit trail.',
  },
  'has-tests': {
    file: 'test/totals.test.mjs',
    label: 'A test suite exists',
    detail: '`npm test` is a runnable stop condition the agent can iterate against.',
  },
};

export const ALL_PATHS = REPO_FILES.map((f) => f.path);

// Fixture orders (amounts in cents).
export const FIXTURES = [
  { name: 'small order', lines: [1999, 1999], expectDiscount: false },              // $39.98 — no discount
  { name: 'threshold order', lines: [5000, 5000], expectDiscount: true },           // $100.00 — boundary
  { name: 'odd-cents order', lines: [3333, 3333, 3333, 2006], expectDiscount: true }, // $120.05 — float drift
];

const THRESHOLD_CENTS = 10000;
const DISCOUNT_PCT = 10;

function expectedTotalCents(lines) {
  const subtotal = lines.reduce((a, b) => a + b, 0);
  if (subtotal < THRESHOLD_CENTS) return subtotal;
  // Integer-cents math: 10% off, rounded to the cent.
  return subtotal - Math.round((subtotal * DISCOUNT_PCT) / 100);
}

// Apply an edit choice to the baseline codebase.
// edit = { scope: 'totals' | 'cart-only', math: 'cents' | 'float', line: boolean }
export function applyEdit(edit) {
  const discounted = (subtotal) => subtotal >= THRESHOLD_CENTS;

  const totalsShared = (lines) => {
    const subtotal = lines.reduce((a, b) => a + b, 0);
    if (!discounted(subtotal)) return subtotal;
    return edit.math === 'cents'
      ? subtotal - Math.round((subtotal * DISCOUNT_PCT) / 100)
      : subtotal * (1 - DISCOUNT_PCT / 100); // float path — drifts
  };

  const cartTotal =
    edit.scope === 'totals'
      ? totalsShared
      : (lines) => {
          // Naive edit: duplicates the logic inside cart.mjs, invoice untouched.
          const subtotal = lines.reduce((a, b) => a + b, 0);
          if (!discounted(subtotal)) return subtotal;
          return edit.math === 'cents'
            ? subtotal - Math.round((subtotal * DISCOUNT_PCT) / 100)
            : subtotal * (1 - DISCOUNT_PCT / 100);
        };

  const invoice = (lines) => {
    const items = lines.map((amount) => ({ kind: 'item', amount }));
    // Invoice still calls the (possibly edited) shared totals function.
    const subtotal = lines.reduce((a, b) => a + b, 0);
    const total = edit.scope === 'totals' ? totalsShared(lines) : subtotal;
    const discountAmount = subtotal - total;
    // A line can only be emitted when the discount actually reaches the
    // invoice — knowing the convention without finding totals.mjs still fails.
    if (edit.line && discountAmount > 0) {
      items.push({ kind: 'discount', label: '10% off (orders ≥ $100)', amount: -discountAmount });
    }
    return { lines: items, total };
  };

  return { cartTotal, invoice, edit };
}

// The repo's own checks — what `npm test` would assert.
export const CHECKS = [
  {
    id: 'feature-works',
    name: 'Feature works',
    detail: 'Orders ≥ $100 are discounted ~10%; smaller orders are unchanged.',
    run(repo) {
      for (const f of FIXTURES) {
        const got = repo.cartTotal(f.lines);
        const want = expectedTotalCents(f.lines);
        // "Plausible" tolerance: a demo user sees the discount apply.
        if (Math.abs(got - want) > 1) {
          return { pass: false, note: `${f.name}: expected ≈${want}¢, got ${got}` };
        }
      }
      return { pass: true, note: 'discount applies where expected' };
    },
  },
  {
    id: 'consistent-totals',
    name: 'Cart and invoice agree',
    detail: 'totals.mjs is shared — cart.total must equal invoice.total exactly.',
    run(repo) {
      for (const f of FIXTURES) {
        const cart = repo.cartTotal(f.lines);
        const inv = repo.invoice(f.lines).total;
        if (cart !== inv) {
          return { pass: false, note: `${f.name}: cart=${cart}¢ but invoice=${inv}¢` };
        }
      }
      return { pass: true, note: 'one source of truth, both views agree' };
    },
  },
  {
    id: 'integer-arithmetic',
    name: 'Exact money math',
    detail: 'Totals are integer cents — no float drift on odd-priced baskets.',
    run(repo) {
      for (const f of FIXTURES) {
        const got = repo.cartTotal(f.lines);
        const want = expectedTotalCents(f.lines);
        if (!Number.isInteger(got) || got !== want) {
          return { pass: false, note: `${f.name}: expected exactly ${want}¢, got ${got}` };
        }
      }
      return { pass: true, note: 'all totals are exact integer cents' };
    },
  },
  {
    id: 'audit-trail',
    name: 'Discount is a line item',
    detail: 'Every discounted invoice shows the adjustment as a line.',
    run(repo) {
      for (const f of FIXTURES) {
        if (!f.expectDiscount) continue;
        const inv = repo.invoice(f.lines);
        const hasLine = inv.lines.some((l) => l.kind === 'discount');
        if (!hasLine) {
          return { pass: false, note: `${f.name}: total changed silently — no discount line` };
        }
      }
      return { pass: true, note: 'adjustments are auditable' };
    },
  },
];

export function runChecks(repo) {
  return CHECKS.map((c) => ({ id: c.id, name: c.name, ...c.run(repo) }));
}
