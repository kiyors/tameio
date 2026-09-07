import { Kbd, KbdGroup } from "@keiri/ui/components/kbd";
import { SidebarTrigger } from "@keiri/ui/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@keiri/ui/components/tooltip";

export function CustomSidebarTrigger() {
  return (
    <Tooltip>
      <TooltipTrigger delay={1000} render={<SidebarTrigger />} />
      <TooltipContent className="px-2 py-1" side="right">
        Toggle Sidebar{" "}
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>b</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}
