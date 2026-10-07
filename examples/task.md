# Task brief — the fixture the lab executes

> Add a discount: orders totalling **$100 or more get 10% off**.
> The cart and the invoice must agree, money math must be exact,
> and accounting requires every adjustment to appear as a line item.

## The codebase under test (`public/repo.mjs`)

| File | What exploring it reveals |
|---|---|
| `src/money.mjs` | Money is integer cents — `pct()` rounds to the cent. |
| `src/totals.mjs` | Single totals function called by **both** cart and invoice. |
| `src/invoice.mjs` | Adjustments must be emitted as line items (audit). |
| `src/cart.mjs` | Renders the total via `totals.mjs` — no own math. |
| `test/totals.test.mjs` | `npm test` is a runnable stop condition. |

## What the loop run does differently

- **Explore** reads the files → 4 facts learned.
- **Plan** emits steps grounded in those facts (edit `totals.mjs` once,
  use `money.pct()`, emit a discount line, run `npm test`).
- **Implement** picks the variant implied by the known facts.
- **Verify** runs the repo's checks and reports evidence.

Prompt-first skips all of it: duplicate logic in `cart.mjs`, `total * 0.9`
floats, no audit line — "feature works" passes while three checks fail latent.
