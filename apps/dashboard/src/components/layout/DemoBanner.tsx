import { Button } from "@keiri/ui/components/button";
import { SparklesIcon, Trash2Icon } from "lucide-react";

import { useDemoData } from "@/hooks/UseDemoData";

export function DemoBanner() {
  const { isActive, clearMutation } = useDemoData();

  if (!isActive) return null;

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-primary font-medium">
        <SparklesIcon className="size-4 animate-pulse" />
        <span className="hidden sm:inline">You are currently exploring Keiri with Demo Data.</span>
        <span className="sm:hidden">Demo Data Active</span>
      </div>
      <Button
        variant="destructive"
        size="sm"
        className="h-7 text-xs"
        onClick={() => {
          if (confirm("Are you sure you want to clear all demo data? This will give you a completely fresh start.")) {
            clearMutation.mutate();
          }
        }}
        disabled={clearMutation.isPending}
      >
        <Trash2Icon className="size-3 mr-2" />
        {clearMutation.isPending ? "Clearing..." : "Start Fresh"}
      </Button>
    </div>
  );
}
