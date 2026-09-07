import { Separator } from "@keiri/ui/components/separator";
import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { BellIcon, MonitorIcon, PaletteIcon, TagIcon, UserCogIcon, WrenchIcon } from "lucide-react";

import { SidebarNav } from "@/components/settings/SidebarNav";

export const Route = createFileRoute("/_dashboard/settings")({
  component: SettingsLayout,
});

const sidebarNavItems = [
  {
    title: "Profile",
    href: "/settings/profile",
    icon: <UserCogIcon className="size-4" />,
  },
  {
    title: "Account",
    href: "/settings/account",
    icon: <WrenchIcon className="size-4" />,
  },
  {
    title: "Categories",
    href: "/settings/categories",
    icon: <TagIcon className="size-4" />,
  },
  {
    title: "Budgets",
    href: "/settings/budgets",
    icon: <MonitorIcon className="size-4" />,
  },
  {
    title: "Appearance",
    href: "/settings/appearance",
    icon: <PaletteIcon className="size-4" />,
  },
  {
    title: "Notifications",
    href: "/settings/notifications",
    icon: <BellIcon className="size-4" />,
  },
  {
    title: "Display",
    href: "/settings/display",
    icon: <MonitorIcon className="size-4" />,
  },
];

import * as React from "react";

function SettingsLayout() {
  const pathname = useLocation({
    select: (location) => location.pathname,
  });

  // Use deferred value so the layout doesn't tear while the next route is suspending
  const deferredPathname = React.useDeferredValue(pathname);
  const isIndex = deferredPathname === "/settings" || deferredPathname === "/settings/";

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 lg:p-8">
      <div className="gap-y-0.5">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and set e-mail preferences.</p>
      </div>
      <Separator className="my-4" />
      <div className="flex flex-1 flex-col gap-y-4 md:gap-y-2 lg:flex-row lg:gap-y-0 lg:gap-x-12">
        {!isIndex && (
          <aside className="top-0 lg:sticky lg:w-1/5 overflow-x-auto pb-2 hidden lg:block">
            <SidebarNav items={sidebarNavItems} />
          </aside>
        )}
        <div className="flex w-full overflow-y-auto p-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
