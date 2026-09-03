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
import { ProfessionalReadinessKitCapture } from "@/components/ProfessionalReadinessKitCapture";

/**
 * Quick Exit, reimplemented in plain JS and inlined so it works from first
 * paint — before React has hydrated and QuickExitButton's own onClick has
 * attached. Streamed SSR puts the button in the DOM immediately; this script
 * runs in <head>, ahead of that markup, and listens via delegation on
 * `document` so it doesn't need the button to exist yet at attach time.
 *
 * Deliberately backs off the instant real hydration completes
 * (QuickExitButton sets window.__ppQuickExitHydrated = true on mount) so it
 * never double-fires against React's own handler, and so drag-to-move keeps
 * working normally once React is driving. Mirrors src/lib/quick-exit.ts —
 * keep the two in sync if that file's exit sequence changes.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
const quickExitFallbackScript = `(function () {
  var SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};
  var SUPABASE_KEY = ${JSON.stringify(SUPABASE_PUBLISHABLE_KEY)};

  function getExitUrl() {
    try {
      var raw = localStorage.getItem("pp_settings_v1");
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed.exitUrl === "string" && parsed.exitUrl) return parsed.exitUrl;
      }
    } catch (e) {}
    return "https://weather.com";
  }

  function quickExit() {
    var url = getExitUrl();
    var accessToken = null;
    var authKeys = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("sb-") === 0 && k.indexOf("auth-token") !== -1) authKeys.push(k);
      }
      for (var j = 0; j < authKeys.length; j++) {
        var raw = localStorage.getItem(authKeys[j]);
        if (raw) {
          try {
            var parsed = JSON.parse(raw);
            accessToken = (parsed && parsed.access_token) || (parsed && parsed.currentSession && parsed.currentSession.access_token) || accessToken;
          } catch (e) {}
        }
      }
    } catch (e) {}
    try {
      for (var m = 0; m < authKeys.length; m++) localStorage.removeItem(authKeys[m]);
    } catch (e) {}
    try {
      var sessionKeys = [];
      for (var n = 0; n < sessionStorage.length; n++) {
        var sk = sessionStorage.key(n);
        if (sk && (sk.indexOf("pp.") === 0 || sk.indexOf("pp_") === 0)) sessionKeys.push(sk);
      }
      for (var p = 0; p < sessionKeys.length; p++) sessionStorage.removeItem(sessionKeys[p]);
    } catch (e) {}
    try {
      if (accessToken && SUPABASE_URL && SUPABASE_KEY) {
        fetch(SUPABASE_URL + "/auth/v1/logout?scope=global", {
          method: "POST",
          keepalive: true,
          headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
        }).catch(function () {});
      }
    } catch (e) {}
    try { document.title = "Weather"; } catch (e) {}
    try { window.history.replaceState(null, "", "/"); } catch (e) {}
    window.location.replace(url);
  }

  window.__ppLastEsc = 0;
  document.addEventListener("click", function (e) {
    if (window.__ppQuickExitHydrated) return;
    var btn = e.target && e.target.closest && e.target.closest("[data-quick-exit]");
    if (!btn) return;
    quickExit();
  }, true);
  document.addEventListener("keydown", function (e) {
    if (window.__ppQuickExitHydrated) return;
    if (e.key === "Escape") {
      var now = Date.now();
      if (now - window.__ppLastEsc < 500) quickExit();
      window.__ppLastEsc = now;
    }
  }, true);
})();`;

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
        children: quickExitFallbackScript,
      },
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
        <ProfessionalReadinessKitCapture />
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
