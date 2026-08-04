import { createFileRoute } from '@tanstack/react-router';
import { createStripeClient } from '@/lib/stripe.server';

export const Route = createFileRoute('/api/public/tmppricecheck')({
  server: {
    handlers: {
      GET: async () => {
        const keys = ['attorney_solo_monthly', 'attorney_firm_charter_monthly', 'attorney_firm_monthly', 'attorney_enterprise_monthly'];
        const out: Record<string, unknown> = {};
        for (const env of ['live', 'sandbox'] as const) {
          try {
            const stripe = createStripeClient(env);
            const prices = await stripe.prices.list({ lookup_keys: keys, limit: 100 });
            out[env] = prices.data.map((p) => ({ lookup_key: p.lookup_key, amount: p.unit_amount, currency: p.currency, active: p.active }));
          } catch (e) {
            out[env] = { error: String(e) };
          }
        }
        return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json' } });
      },
    },
  },
});