import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession, createPayWhatYouCanCheckout } from "@/lib/payments.functions";

interface Props {
  priceId?: string;
  customAmountCents?: number;
  returnUrl?: string;
}

export function StripeEmbeddedCheckout({ priceId, customAmountCents, returnUrl }: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const url = returnUrl || `${window.location.origin}/billing-return?session_id={CHECKOUT_SESSION_ID}`;
    const env = getStripeEnvironment();
    const result = customAmountCents
      ? await createPayWhatYouCanCheckout({
          data: { amountInCents: customAmountCents, returnUrl: url, environment: env },
        })
      : await createCheckoutSession({
          data: { priceId: priceId!, returnUrl: url, environment: env },
        });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("No client secret");
    return result.clientSecret;
  };
  return (
    <div id="checkout" key={customAmountCents ? `pwyc-${customAmountCents}` : `price-${priceId}`}>
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}