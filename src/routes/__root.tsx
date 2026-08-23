import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";
import { GoogleAnalyticsRouteTracker, GA_MEASUREMENT_ID } from "@/lib/ga";

function NotFoundComponent() {
  return (
    <div
      data-persona="survivor"
      className="flex min-h-screen items-center justify-center bg-background px-4"
    >
      <div className="pp-card max-w-md text-center">
        <p className="label-eyebrow">PatternProof</p>
        <h1 className="mt-3 font-display text-7xl text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to="/" className="pp-btn pp-btn-primary">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div
      data-persona="survivor"
      className="flex min-h-screen items-center justify-center bg-background px-4"
    >
      <div className="pp-card max-w-md text-center">
        <p className="label-eyebrow">PatternProof</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="pp-btn pp-btn-primary"
          >
            Try again
          </button>
          <a href="/" className="pp-btn pp-btn-secondary">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PatternProof — Private documentation for your case" },
      {
        name: "description",
        content:
          "Private documentation for survivors of domestic abuse and high-conflict custody cases. Protected with per-user access controls and encrypted in transit.",
      },
      { property: "og:site_name", content: "PatternProof" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "PatternProof — Private documentation for your case" },
      {
        property: "og:description",
        content:
          "Private documentation for survivors of domestic abuse and high-conflict custody cases. Protected with per-user access controls and encrypted in transit.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "PatternProof — Private documentation for your case" },
      {
        name: "twitter:description",
        content:
          "Private documentation for survivors of domestic abuse and high-conflict custody cases. Protected with per-user access controls and encrypted in transit.",
      },
      { name: "twitter:site", content: "@PatternProof" },
      { name: "apple-mobile-web-app-title", content: "Notes" },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/2d6678a9-b954-43a8-9392-d823619bf169",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/2d6678a9-b954-43a8-9392-d823619bf169",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Public+Sans:wght@400;500;600;700;800&family=Source+Serif+4:opsz,wght@8..60,300;8..60,400;8..60,500;8..60,600;8..60,700&family=Figtree:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
      {
        rel: "manifest",
        href: "/manifest.webmanifest",
      },
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      {
        rel: "icon",
        type: "image/png",
        href: "/icons/icon-192.png",
        sizes: "192x192",
      },
      {
        rel: "apple-touch-icon",
        href: "/icons/icon-192.png",
      },
    ],
    scripts: [
      {
        async: true,
        src: `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`,
      },
      {
        children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
// send_page_view is off — GA4's default auto-pageview captures the raw
// URL (query string and all). GoogleAnalyticsRouteTracker sends every
// pageview itself, including the first, with tokens/query stripped first.
gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });`,
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://pattern-proof.tech/#organization",
              name: "PatternProof",
              url: "https://pattern-proof.tech/",
              description:
                "Private documentation for survivors of domestic abuse and high-conflict custody cases. Protected with per-user access controls and encrypted in transit.",
            },
            {
              "@type": "WebSite",
              "@id": "https://pattern-proof.tech/#website",
              name: "PatternProof",
              url: "https://pattern-proof.tech/",
              description:
                "Private documentation for your case, encrypted in transit and protected with per-user access controls. Visible only to you and anyone you choose to share it with.",
              publisher: { "@id": "https://pattern-proof.tech/#organization" },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="pp-app">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <GoogleAnalyticsRouteTracker />
        <Outlet />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "var(--pp-ground)",
              color: "var(--pp-ink)",
              border: "none",
              borderRadius: "var(--pp-r-lg, 20px)",
              fontFamily: "var(--font-sans)",
              boxShadow: "var(--pp-shadow-up)",
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
