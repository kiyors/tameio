import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@keiri/ui/components/breadcrumb";
import { Button } from "@keiri/ui/components/button";
import { Separator } from "@keiri/ui/components/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@keiri/ui/components/tooltip";
import { Link, useLocation } from "@tanstack/react-router";
import { BellIcon, SearchIcon, SendIcon } from "lucide-react";
import * as React from "react";

import { CustomSidebarTrigger } from "@/components/layout/CustomSidebarTrigger";
import { ModeToggle } from "@/components/ModeToggle";

const generateBreadcrumbs = (path: string) => {
  if (path === "/") return [{ label: "Overview", href: "/" }];

  const segments = path.split("/").filter(Boolean);
  const crumbs = [];

  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    currentPath += `/${seg}`;

    let label = seg;
    if (seg === "p2p") {
      label = "P2P";
    } else {
      // Capitalize 'shared-ledgers' to 'Shared Ledgers'
      label = seg
        .split("-")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    }

    crumbs.push({ label, href: currentPath });
  }
  return crumbs;
};

export function AppNavbar() {
  const pathname = useLocation().pathname;
  const breadcrumbs = generateBreadcrumbs(pathname);

  return (
    <header
      className="flex h-16 shrink-0 items-center justify-between gap-2 px-4 shadow-sm border-b z-10 sticky top-0 bg-background/95 backdrop-blur-sm"
      style={{ viewTransitionName: "persistent-nav" }}
    >
      <div className="flex items-center gap-2">
        <CustomSidebarTrigger />
        <Separator className="mr-2 h-4 data-[orientation=vertical]:self-center" orientation="vertical" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink render={<Link to="/" />}>Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbs.map((bc, idx) => (
              <React.Fragment key={bc.href}>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  {idx === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage>{bc.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink className="hidden md:block" render={<Link to={bc.href as never} />}>
                      {bc.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-3">
        {/* Global Search Trigger */}
        <button
          type="button"
          onClick={() => {
            const event = new KeyboardEvent("keydown", {
              key: "k",
              metaKey: true,
              bubbles: true,
            });
            document.dispatchEvent(event);
          }}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 hover:bg-muted border rounded-lg transition-colors group"
        >
          <SearchIcon className="size-3.5 group-hover:text-foreground transition-colors" />
          <span>Search...</span>
          <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border bg-background px-1 font-mono text-[10px] font-medium opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>

        <ModeToggle />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button size="icon-sm" variant="outline" aria-label="Quick send">
                <SendIcon data-icon="inline-start" />
              </Button>
            }
          />
          <TooltipContent>Quick send</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button aria-label="Notifications" size="icon-sm" variant="outline">
                <BellIcon />
              </Button>
            }
          />
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
