import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@keiri/ui/components/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@keiri/ui/components/sidebar";
import { cn } from "@keiri/ui/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  AlarmClockIcon,
  ChevronRightIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  MessageSquareShareIcon,
  NotebookTabsIcon,
  ReceiptIcon,
  RepeatIcon,
  ScaleIcon,
  Settings2Icon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import * as React from "react";
import { startTransition, useState } from "react";

import { LogoIcon } from "@/components/Logo";
import { api } from "@/lib/ApiClient";

export type SidebarNavItem = {
  title: string;
  url: string;
  icon: React.ReactNode;
  isActive?: boolean;
  items?: { title: string; url: string; icon?: React.ReactNode }[];
};

type SidebarSection = {
  label: string;
  items: SidebarNavItem[];
};

const navSections: SidebarSection[] = [
  {
    label: "Main",
    items: [
      {
        title: "Dashboard",
        url: "/",
        icon: <LayoutDashboardIcon />,
      },
      {
        title: "Transactions",
        url: "/transactions",
        icon: <ReceiptIcon />,
      },
      {
        title: "Wallets",
        url: "/wallets",
        icon: <WalletIcon />,
      },
      {
        title: "P2P & Sharing",
        url: "#",
        icon: <MessageSquareShareIcon />,
        items: [
          {
            title: "Pending Requests",
            url: "/p2p/pending",
            icon: <AlarmClockIcon />,
          },
          {
            title: "Shared Ledgers",
            url: "/p2p/shared-ledgers",
            icon: <NotebookTabsIcon />,
          },
          {
            title: "Ledger Tabs",
            url: "/p2p/ledger-tabs",
            icon: <HistoryIcon />,
          },
        ],
      },
      {
        title: "Subscriptions",
        url: "/subscriptions",
        icon: <RepeatIcon />,
      },
      {
        title: "Reconciliation",
        url: "/reconciliation",
        icon: <ScaleIcon />,
      },
      {
        title: "Contacts",
        url: "/contacts",
        icon: <UsersIcon />,
      },
    ],
  },
  {
    label: "Secondary",
    items: [
      {
        title: "Settings",
        url: "/settings",
        icon: <Settings2Icon />,
      },
    ],
  },
];

import { NavUser } from "@/components/layout/NavUser";

function SidebarNavItemComponent({ item, pathname }: { item: SidebarNavItem; pathname: string }) {
  const navigateFn = useNavigate();
  const queryClient = useQueryClient();
  const isItemActive = item.isActive || pathname === item.url || item.items?.some((i) => pathname.startsWith(i.url));
  const [isOpen, setIsOpen] = useState(isItemActive);

  const navigate = (url: string) => {
    startTransition(() => {
      // React 19's `addTransitionType` is experimental and not in the public
      // type surface yet; the runtime check lets us no-op cleanly when it's
      // absent. Both `as any` casts below sit behind the same justification.
      // biome-ignore lint/suspicious/noExplicitAny: experimental React API not yet typed.
      const reactWithExperimental = React as unknown as { addTransitionType?: (type: string) => void };
      if (typeof reactWithExperimental.addTransitionType === "function") {
        reactWithExperimental.addTransitionType("nav-forward");
      }
      void navigateFn({ to: url });
    });
  };

  const prefetch = (url: string) => {
    if (url === "/") {
      void queryClient.prefetchQuery({
        queryKey: ["transaction-summary"],
        queryFn: () => api.get("/api/transactions/summary"),
      });
    } else if (url === "/transactions") {
      void queryClient.prefetchQuery({
        queryKey: ["transactions", { limit: 15, offset: 0 }],
        queryFn: () => api.get("/api/transactions?limit=15&offset=0"),
      });
    }
  };

  return (
    <Collapsible key={item.title} open={isOpen} onOpenChange={setIsOpen} render={<SidebarMenuItem />}>
      {item.items?.length ? (
        <CollapsibleTrigger render={<SidebarMenuButton tooltip={item.title} isActive={isItemActive} />}>
          {item.icon}
          <span>{item.title}</span>
          <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
      ) : (
        <SidebarMenuButton
          isActive={item.isActive || pathname === item.url || (item.url !== "/" && pathname.startsWith(item.url))}
          tooltip={item.title}
          onClick={() => navigate(item.url)}
          onMouseEnter={() => prefetch(item.url)}
        >
          {item.icon}
          <span>{item.title}</span>
        </SidebarMenuButton>
      )}
      {item.items?.length ? (
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items?.map((subItem) => (
              <SidebarMenuSubItem key={subItem.title}>
                <SidebarMenuSubButton
                  isActive={pathname === subItem.url || pathname.startsWith(subItem.url)}
                  onClick={() => navigate(subItem.url)}
                  onMouseEnter={() => prefetch(subItem.url)}
                >
                  {subItem.icon}
                  <span>{subItem.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

export function AppSidebar() {
  const pathname = useLocation().pathname;
  const navigateFn = useNavigate();

  const navigateHome = () => {
    startTransition(() => {
      // Same experimental `addTransitionType` as in `navigate` above.
      // biome-ignore lint/suspicious/noExplicitAny: experimental React API not yet typed.
      const reactWithExperimental = React as unknown as { addTransitionType?: (type: string) => void };
      if (typeof reactWithExperimental.addTransitionType === "function") {
        reactWithExperimental.addTransitionType("nav-back");
      }
      void navigateFn({ to: "/" });
    });
  };

  return (
    <Sidebar
      className={cn(
        "*:data-[slot=sidebar-inner]:bg-background",
        "*:data-[slot=sidebar-inner]:dark:bg-[radial-gradient(60%_18%_at_10%_0%,--theme(--color-foreground/.08),transparent)]",
        "**:data-[slot=sidebar-menu-button]:[&>span]:text-foreground/75",
      )}
      collapsible="icon"
      variant="sidebar"
      style={{ viewTransitionName: "persistent-sidebar" }}
    >
      <SidebarHeader className="h-14 justify-center border-b px-2">
        <SidebarMenuButton onClick={navigateHome}>
          <LogoIcon />
          <span className="font-medium">Keiri</span>
        </SidebarMenuButton>
      </SidebarHeader>
      <SidebarContent>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
              {section.label}
            </SidebarGroupLabel>
            <SidebarMenu>
              {section.items.map((item) => (
                <SidebarNavItemComponent key={item.title} item={item} pathname={pathname} />
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-0 p-2">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
