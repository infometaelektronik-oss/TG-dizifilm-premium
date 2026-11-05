import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";

// Tipografi: Orbitron (sci-fi başlık), Bebas Neue (sinema), Audiowide (retro)
import "@fontsource/orbitron/500.css";
import "@fontsource/orbitron/700.css";
import "@fontsource/orbitron/900.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/audiowide/400.css";

import { reportLovableError } from "../lib/lovable-error-reporting";

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

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

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
      { title: "TG. Dizi Film" },
      { name: "description", content: "TG. Dizi Film: Canlı TV, Radyo, Diziler, Filmler ve TG TV otonom yayın platformu." },
      { property: "og:title", content: "TG. Dizi Film" },
      { property: "og:description", content: "TG. Dizi Film: Canlı TV, Radyo, Diziler, Filmler ve TG TV otonom yayın platformu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TG. Dizi Film" },
      { name: "twitter:description", content: "TG. Dizi Film: Canlı TV, Radyo, Diziler, Filmler ve TG TV otonom yayın platformu." },
      { property: "og:image", content: "/assets/aistudio/Media_item_1_1bba30da.jpg" },
      { name: "twitter:image", content: "/assets/aistudio/Media_item_1_1bba30da.jpg" },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // TV Box / Smart TV tespiti — donma ve D-Pad odağı için kritik
    const ua = navigator.userAgent;
    const isTv =
      /AndroidTV|GoogleTV|BRAVIA|Aftb|SmartTV|CrKey|SMART-TV|Tizen|Web0S|WebOS|HbbTV|NetCast|Viera|PhilipsTV|Mi Box|MiTV|Nvidia Shield|Fire ?TV|BravIA/i.test(
        ua,
      ) ||
      // Bazı Android TV Box'lar mobile UA gönderir ama touch yok
      (!("ontouchstart" in window) && window.matchMedia("(pointer: coarse)").matches === false && /Android/.test(ua) && window.innerWidth >= 1280);
    if (isTv) {
      document.documentElement.dataset.tv = "1";
    }

    // Auto-cleanup legacy 128 cache from localStorage to guarantee 4,429 fresh items
    try {
      const dbStr = localStorage.getItem("tg_dizi_db");
      if (dbStr) {
        const parsed = JSON.parse(dbStr);
        if (parsed.user_streams) {
          delete parsed.user_streams;
          localStorage.setItem("tg_dizi_db", JSON.stringify(parsed));
          window.dispatchEvent(new CustomEvent("tg-db-synced"));
        }
      }
    } catch {
      // ignore
    }

    // D-Pad kilit: yön tuşlarında tarayıcı scroll'unu engelle, spatial nav'a bırak
    const onKey = (e: KeyboardEvent) => {
      const nav = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (nav.includes(e.key)) {
        const t = e.target as HTMLElement | null;
        if (!t || (t.tagName !== "INPUT" && t.tagName !== "TEXTAREA")) e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
