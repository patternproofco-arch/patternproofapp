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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
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
      { name: "description", content: "Private documentation for survivors of domestic abuse and high-conflict custody cases. Protected with per-user access controls and encrypted in transit." },
      { property: "og:site_name", content: "PatternProof" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "PatternProof — Private documentation for your case" },
      { property: "og:description", content: "Private documentation for survivors of domestic abuse and high-conflict custody cases. Protected with per-user access controls and encrypted in transit." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "PatternProof — Private documentation for your case" },
      { name: "twitter:description", content: "Private documentation for survivors of domestic abuse and high-conflict custody cases. Protected with per-user access controls and encrypted in transit." },
      { name: "twitter:site", content: "@PatternProof" },
      // Home-screen identity only (installed app), deliberately low-signal.
      // Browser tab title and marketing copy above stay branded.
      { name: "apple-mobile-web-app-title", content: "Notes" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/2d6678a9-b954-43a8-9392-d823619bf169" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/2d6678a9-b954-43a8-9392-d823619bf169" },
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
        href: "https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Figtree:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
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
gtag('config', '${GA_MEASUREMENT_ID}');`,
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
              description: "Private documentation for survivors of domestic abuse and high-conflict custody cases. Protected with per-user access controls and encrypted in transit.",
            },
            {
              "@type": "WebSite",
              "@id": "https://pattern-proof.tech/#website",
              name: "PatternProof",
              url: "https://pattern-proof.tech/",
              description: "Private documentation for your case, encrypted in transit and protected with per-user access controls. Visible only to you and anyone you choose to share it with.",
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
      <body>
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
        <Toaster position="top-center" toastOptions={{ style: { background: "#FFFCF1", color: "#1F1A14", border: "1px solid rgba(31,26,20,0.12)", borderRadius: "14px", fontFamily: "Inter, system-ui" } }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
