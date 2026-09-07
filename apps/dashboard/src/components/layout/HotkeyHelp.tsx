import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@keiri/ui/components/dialog";

import { useGlobalStore } from "@/lib/Store";

export function HotkeyHelp() {
  const { isHotkeyHelpOpen, setHotkeyHelpOpen } = useGlobalStore();

  const shortcuts = [
    { key: "⌘ K", label: "Open Command Palette" },
    { key: "N", label: "Add New Transaction" },
    { key: "?", label: "Show this help" },
    { key: "G D", label: "Go to Dashboard" },
    { key: "G T", label: "Go to Transactions" },
    { key: "G W", label: "Go to Wallets" },
    { key: "G C", label: "Go to Contacts" },
    { key: "Esc", label: "Close modals / palette" },
  ];

  return (
    <Dialog open={isHotkeyHelpOpen} onOpenChange={setHotkeyHelpOpen}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {shortcuts.map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-2 font-mono text-[12px] font-medium text-foreground opacity-100">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
