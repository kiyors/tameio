import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@keiri/ui/components/command";
import { cn } from "@keiri/ui/lib/utils";
import { useHotkey, useHotkeySequence } from "@tanstack/react-hotkeys";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BellIcon,
  CameraIcon,
  CornerDownLeftIcon,
  LayoutDashboardIcon,
  MonitorIcon,
  PaletteIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  SettingsIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import * as React from "react";
import { useCallback } from "react";

import { useContacts } from "@/hooks/UseContacts";
import { useWallets } from "@/hooks/UseWallets";
import { useGlobalStore } from "@/lib/Store";

export function CommandCenter() {
  const [open, setOpen] = React.useState(false);
  const navigate = useNavigate();
  const push = useCallback((url: string) => navigate({ to: url }), [navigate]);
  const { setTransactionModalOpen, setOCRModalOpen, setCategoryModalOpen, setHotkeyHelpOpen } = useGlobalStore();
  const [_isTransitionPending, startTransition] = React.useTransition();

  // Custom Double-Space Trigger
  React.useEffect(() => {
    let lastSpaceTime = 0;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const isInput =
          ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName) ||
          (e.target as HTMLElement).isContentEditable;

        if (isInput) return;

        const currentTime = Date.now();
        const timeDiff = currentTime - lastSpaceTime;

        if (timeDiff > 0 && timeDiff < 300) {
          e.preventDefault();
          setOpen((prev) => !prev);
          lastSpaceTime = 0;
        } else {
          lastSpaceTime = currentTime;
        }
      } else {
        lastSpaceTime = 0;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch data for quick search
  const { contacts } = useContacts({ enabled: open });
  const { wallets } = useWallets({ enabled: open });

  // Toggle Command Palette
  useHotkey({ key: "K", mod: true }, (e) => {
    e.preventDefault();
    setOpen((prev) => !prev);
  });

  // Global Quick Shortcuts
  useHotkey("N", (_e) => {
    if (open) return;
    setTransactionModalOpen(true);
  });

  useHotkey("U", (_e) => {
    if (open) return;
    setOCRModalOpen(true);
  });

  useHotkey("C", (_e) => {
    if (open) return;
    setCategoryModalOpen(true);
  });

  useHotkey({ key: "?" }, (_e) => {
    if (open) return;
    setHotkeyHelpOpen(true);
  });

  // Navigation Sequences
  useHotkeySequence(["G", "D"], () => {
    if (!open) {
      startTransition(() => {
        void push("/");
      });
    }
  });
  useHotkeySequence(["G", "T"], () => {
    if (!open) {
      startTransition(() => {
        void push("/transactions");
      });
    }
  });
  useHotkeySequence(["G", "W"], () => {
    if (!open) {
      startTransition(() => {
        void push("/wallets");
      });
    }
  });
  useHotkeySequence(["G", "C"], () => {
    if (!open) {
      startTransition(() => {
        void push("/contacts");
      });
    }
  });
  useHotkeySequence(["G", "S"], () => {
    if (!open) {
      startTransition(() => {
        void push("/settings");
      });
    }
  });
  useHotkeySequence(["G", "R"], () => {
    if (!open) {
      startTransition(() => {
        void push("/reconciliation");
      });
    }
  });
  useHotkeySequence(["G", "L"], () => {
    if (!open) {
      startTransition(() => {
        void push("/p2p/ledger-tabs");
      });
    }
  });

  // Settings & Theme
  useHotkey({ key: ",", mod: true }, (e) => {
    e.preventDefault();
    if (!open) {
      startTransition(() => {
        void push("/settings");
      });
    }
  });

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const navItems = React.useMemo(
    () => [
      {
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboardIcon,
        shortcut: "G D",
        color: "text-blue-500",
      },
      {
        label: "Transactions",
        href: "/transactions",
        icon: ReceiptIcon,
        shortcut: "G T",
        color: "text-emerald-500",
      },
      {
        label: "Wallets",
        href: "/wallets",
        icon: WalletIcon,
        shortcut: "G W",
        color: "text-orange-500",
      },
      {
        label: "Contacts",
        href: "/contacts",
        icon: UsersIcon,
        shortcut: "G C",
        color: "text-purple-500",
      },
    ],
    [],
  );

  const settingItems = React.useMemo(
    () => [
      { label: "Profile Settings", href: "/settings/profile", icon: UserIcon },
      { label: "Appearance", href: "/settings/appearance", icon: PaletteIcon },
      { label: "Categories", href: "/settings/categories", icon: TagIcon },
      {
        label: "Notifications",
        href: "/settings/notifications",
        icon: BellIcon,
      },
      { label: "Display", href: "/settings/display", icon: MonitorIcon },
      { label: "Account", href: "/settings/account", icon: SettingsIcon },
    ],
    [],
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      className="bg-background/40 backdrop-blur-3xl border border-white/10 dark:border-white/5 shadow-[0_0_80px_-20px_rgba(0,0,0,0.6)] overflow-hidden p-0 sm:max-w-2xl ring-1 ring-white/10"
    >
      <div className="absolute inset-0 bg-linear-to-b from-white/5 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[url('/noise.svg')] opacity-[0.08] pointer-events-none mix-blend-overlay" />

      <CommandInput placeholder="Search anything..." />

      <CommandList className="max-h-[480px] p-2 no-scrollbar scroll-smooth relative z-10 [&_[cmdk-list-sizer]]:flex [&_[cmdk-list-sizer]]:flex-wrap">
        <CommandEmpty className="py-12 text-center w-full">
          <div className="bg-muted/50 size-12 rounded-full flex items-center justify-center mx-auto mb-4">
            <SearchIcon className="size-6 text-muted-foreground/40" />
          </div>
          <p className="text-muted-foreground font-medium">No results found.</p>
        </CommandEmpty>

        <CommandGroup heading="Quick Actions" className="px-2 w-full">
          <CommandItem
            value="add transaction manual entry new"
            onSelect={() => runCommand(() => setTransactionModalOpen(true))}
            className="flex items-center gap-4 p-3 rounded-xl mb-1 data-selected:bg-primary/10 data-selected:text-primary transition-all group"
          >
            <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center group-data-selected:scale-110 transition-transform">
              <PlusIcon className="size-5 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-sm text-foreground">Manual Entry</span>
              <span className="text-xs text-muted-foreground group-data-selected:text-primary/70">
                Record a new income or expense
              </span>
            </div>
            <CommandShortcut className="opacity-100 font-bold text-foreground pr-1">N</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="scan receipt ocr image upload"
            onSelect={() => runCommand(() => setOCRModalOpen(true))}
            className="flex items-center gap-4 p-3 rounded-xl mb-1 data-selected:bg-emerald-500/10 data-selected:text-emerald-500 transition-all group"
          >
            <div className="size-10 rounded-lg bg-emerald-500/10 flex items-center justify-center group-data-selected:scale-110 transition-transform">
              <CameraIcon className="size-5 text-emerald-500" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-sm text-foreground">Scan Receipt</span>
              <span className="text-xs text-muted-foreground group-data-selected:text-emerald-500/70">
                Auto-extract data using AI scanner
              </span>
            </div>
            <CommandShortcut className="opacity-100 font-bold text-foreground pr-1">U</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="create new category tag"
            onSelect={() => runCommand(() => setCategoryModalOpen(true))}
            className="flex items-center gap-4 p-3 rounded-xl mb-1 data-selected:bg-purple-500/10 data-selected:text-purple-500 transition-all group"
          >
            <div className="size-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-data-selected:scale-110 transition-transform">
              <TagIcon className="size-5 text-purple-500" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-sm text-foreground">New Category</span>
              <span className="text-xs text-muted-foreground group-data-selected:text-purple-500/70">
                Create a custom category for transactions
              </span>
            </div>
            <CommandShortcut className="opacity-100 font-bold text-foreground pr-1">C</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator className="my-2 opacity-30 w-full" />

        <CommandGroup heading="Navigation" className="px-2 w-full">
          {navItems.map((nav) => (
            <CommandItem
              key={nav.href}
              value={nav.label}
              onSelect={() => runCommand(() => React.startTransition(() => push(nav.href)))}
              className="flex items-center gap-4 p-3 rounded-xl mb-1 transition-all group"
            >
              <div className="size-10 rounded-lg bg-muted/50 flex items-center justify-center group-data-selected:bg-background transition-colors">
                <nav.icon className={cn("size-5", nav.color)} />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-sm text-foreground">{nav.label}</span>
                <span className="text-xs text-muted-foreground">Jump to your {nav.label.toLowerCase()} page</span>
              </div>
              <CommandShortcut className="opacity-100 font-bold text-foreground pr-1">{nav.shortcut}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator className="my-2 opacity-30 w-full" />

        {/* Wallets - Left Half */}
        <CommandGroup heading="Wallets" className="px-2 w-1/2">
          <div className="flex flex-col gap-1">
            {wallets?.slice(0, 4).map((wallet) => (
              <CommandItem
                key={wallet.id}
                value={wallet.name}
                onSelect={() => runCommand(() => React.startTransition(() => push("/wallets")))}
                className="flex items-center gap-3 px-3 py-2 rounded-xl mb-1 transition-all group"
              >
                <div className="size-8 rounded-lg bg-muted/30 flex items-center justify-center group-data-selected:bg-background/50 transition-colors">
                  <WalletIcon className="size-4 text-muted-foreground" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-foreground truncate">{wallet.name}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    ₹{parseFloat(wallet.balance).toLocaleString()}
                  </span>
                </div>
              </CommandItem>
            ))}
          </div>
        </CommandGroup>

        {/* Contacts - Right Half */}
        <CommandGroup heading="Recent Contacts" className="px-2 w-1/2 border-l border-white/5">
          <div className="flex flex-col gap-1">
            {contacts?.slice(0, 4).map((contact) => (
              <CommandItem
                key={contact.id}
                value={contact.name}
                onSelect={() => runCommand(() => React.startTransition(() => push(`/contacts/${contact.id}`)))}
                className="flex items-center gap-3 px-3 py-2 rounded-xl mb-1 transition-all group"
              >
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center group-data-selected:bg-primary/20 transition-colors">
                  <span className="text-[10px] font-bold text-primary uppercase">{contact.name.charAt(0)}</span>
                </div>
                <span className="text-xs font-semibold text-foreground truncate">{contact.name}</span>
              </CommandItem>
            ))}
          </div>
        </CommandGroup>

        <CommandSeparator className="my-2 opacity-30 w-full" />

        <CommandGroup heading="Settings" className="px-2 w-full">
          {settingItems.map((item) => (
            <CommandItem
              key={item.href}
              value={item.label}
              onSelect={() => runCommand(() => React.startTransition(() => push(item.href)))}
              className="flex items-center gap-4 px-3 py-2 rounded-xl mb-1 transition-all group"
            >
              <div className="size-8 rounded-lg bg-muted/50 flex items-center justify-center group-data-selected:bg-background transition-colors">
                <item.icon className="size-4 text-muted-foreground" />
              </div>
              <span className="font-medium text-sm text-foreground">{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>

      <div className="flex items-center gap-4 border-t border-white/5 bg-muted/20 px-4 py-3 text-[10px] text-muted-foreground select-none relative z-20">
        <div className="flex items-center gap-1.5">
          <kbd className="rounded border border-white/10 bg-background/50 px-1.5 py-0.5 font-mono font-bold text-foreground inline-flex items-center shadow-sm">
            <CornerDownLeftIcon className="size-3" />
          </kbd>
          <span className="font-medium">select</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-white/10 bg-background/50 px-1.5 py-0.5 font-mono font-bold text-foreground inline-flex items-center shadow-sm">
              <ArrowUpIcon className="size-3" />
            </kbd>
            <kbd className="rounded border border-white/10 bg-background/50 px-1.5 py-0.5 font-mono font-bold text-foreground inline-flex items-center shadow-sm">
              <ArrowDownIcon className="size-3" />
            </kbd>
          </div>
          <span className="font-medium">navigate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-white/10 bg-background/50 px-1.5 py-0.5 font-mono font-bold text-foreground inline-flex items-center shadow-sm text-[8px]">
              Ctrl
            </kbd>
            <kbd className="rounded border border-white/10 bg-background/50 px-2 py-0.5 font-mono font-bold text-foreground inline-flex items-center shadow-sm">
              J
            </kbd>
            <kbd className="rounded border border-white/10 bg-background/50 px-2 py-0.5 font-mono font-bold text-foreground inline-flex items-center shadow-sm">
              K
            </kbd>
          </div>
          <span className="font-medium">vim</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <kbd className="rounded border border-white/10 bg-background/50 px-1.5 py-0.5 font-mono font-bold text-foreground shadow-sm">
            esc
          </kbd>
          <span className="font-medium">close</span>
        </div>
      </div>
    </CommandDialog>
  );
}
