import { SidebarInset, SidebarProvider } from "@keiri/ui/components/sidebar";

import { AppNavbar } from "@/components/layout/AppNavbar";
import { AppSidebar } from "@/components/layout/AppSidebar";

export function SidebarClient({ defaultOpen, children }: { defaultOpen: boolean; children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <SidebarInset>
        <AppNavbar />
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
