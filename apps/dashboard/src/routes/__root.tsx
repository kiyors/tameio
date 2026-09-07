import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import * as React from "react";

const TanStackDevtools = import.meta.env.DEV
  ? React.lazy(() => import("@tanstack/react-devtools").then((res) => ({ default: res.TanStackDevtools })))
  : () => null;

const TanStackRouterDevtoolsPanel = import.meta.env.DEV
  ? React.lazy(() =>
      import("@tanstack/react-router-devtools").then((res) => ({ default: res.TanStackRouterDevtoolsPanel })),
    )
  : () => null;

const ReactQueryDevtoolsPanel = import.meta.env.DEV
  ? React.lazy(() => import("@tanstack/react-query-devtools").then((res) => ({ default: res.ReactQueryDevtoolsPanel })))
  : () => null;

import { Providers } from "../providers/Providers";

import appCss from "../styles.css?url";

interface MyRouterContext {
  queryClient: QueryClient;
}

import { NotFoundPage } from "@/components/NotFound";

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Keiri",
      },
      {
        name: "description",
        content: "Intelligent bookkeeping, OCR receipt management, and accounting.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFoundPage,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased [overflow-wrap:anywhere] selection:bg-[rgba(79,184,178,0.24)]">
        <Providers>{children}</Providers>
        {import.meta.env.DEV && (
          <React.Suspense fallback={null}>
            <TanStackDevtools
              config={{
                position: "bottom-right",
              }}
              plugins={[
                {
                  name: "TanStack Router",
                  render: <TanStackRouterDevtoolsPanel />,
                },
                {
                  name: "TanStack Query",
                  render: <ReactQueryDevtoolsPanel />,
                },
              ]}
            />
          </React.Suspense>
        )}
        <Scripts />
      </body>
    </html>
  );
}
