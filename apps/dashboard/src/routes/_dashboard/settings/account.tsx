import { Button } from "@keiri/ui/components/button";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { Separator } from "@keiri/ui/components/separator";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/settings/account")({
  component: SettingsAccountPage,
});

function SettingsAccountPage() {
  return (
    <div className="gap-y-6 w-full max-w-2xl">
      <div>
        <h3 className="text-lg font-medium">Account</h3>
        <p className="text-sm text-muted-foreground">
          Update your account settings. Set your preferred language and timezone.
        </p>
      </div>
      <Separator />
      <div className="gap-y-8">
        <div className="gap-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Your name" />
          <p className="text-[0.8rem] text-muted-foreground">
            This is the name that will be displayed on your profile and in emails.
          </p>
        </div>

        <div className="gap-y-2">
          <Label htmlFor="currency">Default Currency</Label>
          <select
            id="currency"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            defaultValue="INR"
          >
            <option value="INR">₹ Indian Rupee (INR)</option>
            <option value="USD">$ US Dollar (USD)</option>
            <option value="EUR">€ Euro (EUR)</option>
            <option value="GBP">£ Pound Sterling (GBP)</option>
          </select>
          <p className="text-[0.8rem] text-muted-foreground">Set the default currency for new transactions.</p>
        </div>

        <Button onClick={() => toast.success("Account settings updated!")}>Update account</Button>
      </div>
    </div>
  );
}
