import { Button } from "@keiri/ui/components/button";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Label } from "@keiri/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@keiri/ui/components/radio-group";
import { Separator } from "@keiri/ui/components/separator";
import { createFileRoute } from "@tanstack/react-router";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";

export const Route = createFileRoute("/_dashboard/settings/appearance")({
  component: SettingsAppearancePage,
});

function SettingsAppearancePage() {
  const { theme, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = React.useState(theme || "system");

  const handleSave = () => {
    setTheme(selectedTheme);
    toast.success("Appearance updated!");
  };

  return (
    <div className="gap-y-6 w-full max-w-2xl">
      <div>
        <h3 className="text-lg font-medium">Appearance</h3>
        <p className="text-sm text-muted-foreground">
          Customize the appearance of the app. Automatically switch between day and night themes.
        </p>
      </div>
      <Separator />
      <div className="gap-y-8">
        <div className="gap-y-4">
          <Label>Theme</Label>
          <p className="text-[0.8rem] text-muted-foreground">Select the theme for the dashboard.</p>
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "light", label: "Light", icon: SunIcon },
              { value: "dark", label: "Dark", icon: MoonIcon },
              { value: "system", label: "System", icon: MonitorIcon },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedTheme(value)}
                className={`flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-all hover:bg-muted/50 cursor-pointer ${
                  selectedTheme === value ? "border-primary bg-primary/5" : "border-muted"
                }`}
              >
                <Icon className={`size-6 ${selectedTheme === value ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${selectedTheme === value ? "text-primary" : ""}`}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="gap-y-4">
          <Label>Font Size</Label>
          <RadioGroup defaultValue="default" className="grid gap-3">
            <div className="flex items-center gap-x-3">
              <RadioGroupItem value="small" id="font-small" />
              <Label htmlFor="font-small" className="font-normal">
                Small
              </Label>
            </div>
            <div className="flex items-center gap-x-3">
              <RadioGroupItem value="default" id="font-default" />
              <Label htmlFor="font-default" className="font-normal">
                Default
              </Label>
            </div>
            <div className="flex items-center gap-x-3">
              <RadioGroupItem value="large" id="font-large" />
              <Label htmlFor="font-large" className="font-normal">
                Large
              </Label>
            </div>
          </RadioGroup>
        </div>

        <Button onClick={handleSave}>Update appearance</Button>
      </div>
    </div>
  );
}
