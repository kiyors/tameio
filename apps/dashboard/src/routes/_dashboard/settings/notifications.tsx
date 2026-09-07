import { Button } from "@keiri/ui/components/button";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Label } from "@keiri/ui/components/label";
import { Separator } from "@keiri/ui/components/separator";
import { Switch } from "@keiri/ui/components/switch";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/settings/notifications")({
  component: SettingsNotificationsPage,
});

function SettingsNotificationsPage() {
  return (
    <div className="gap-y-6 w-full max-w-2xl">
      <div>
        <h3 className="text-lg font-medium">Notifications</h3>
        <p className="text-sm text-muted-foreground">Configure how you receive notifications.</p>
      </div>
      <Separator />
      <div className="gap-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="gap-y-0.5">
            <Label className="text-base">Transaction Alerts</Label>
            <p className="text-[0.8rem] text-muted-foreground">
              Receive notifications when a new transaction is added or modified.
            </p>
          </div>
          <Switch defaultChecked />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="gap-y-0.5">
            <Label className="text-base">P2P Requests</Label>
            <p className="text-[0.8rem] text-muted-foreground">
              Get notified when someone sends you a split or group invite.
            </p>
          </div>
          <Switch defaultChecked />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="gap-y-0.5">
            <Label className="text-base">Subscription Reminders</Label>
            <p className="text-[0.8rem] text-muted-foreground">Remind you before a recurring subscription is due.</p>
          </div>
          <Switch defaultChecked />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="gap-y-0.5">
            <Label className="text-base">Marketing Emails</Label>
            <p className="text-[0.8rem] text-muted-foreground">Receive emails about new features and tips.</p>
          </div>
          <Switch />
        </div>

        <Button onClick={() => toast.success("Notification preferences saved!")}>Update notifications</Button>
      </div>
    </div>
  );
}
