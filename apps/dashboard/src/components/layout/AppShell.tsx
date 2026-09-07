import { SidebarInset, SidebarProvider } from "@keiri/ui/components/sidebar";

import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { AppNavbar } from "@/components/layout/AppNavbar";
import { AppSidebar } from "@/components/layout/AppSidebar";

export function AppShell() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppNavbar />
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          <DashboardSkeleton />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
