const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div
        className="w-full border-b px-4 py-2 text-center text-sm"
        style={{ background: "rgba(231,123,86,0.35)", borderColor: "rgba(231,123,86,0.5)", color: "var(--pp-urgent)" }}
      >
        Production checkout is not configured. Complete Stripe go-live to accept real payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div
        className="w-full border-b px-4 py-2 text-center text-sm"
        style={{ background: "rgba(231,208,163,0.5)", borderColor: "rgba(180,120,20,0.35)", color: "var(--pp-urgent)" }}
      >
        All payments made in preview are in test mode. Use card 4242 4242 4242 4242 with any future expiry & CVC.
      </div>
    );
  }
  return null;
}