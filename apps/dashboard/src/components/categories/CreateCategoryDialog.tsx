import type { Category } from "@keiri/types";
import { Button } from "@keiri/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@keiri/ui/components/dialog";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { cn } from "@keiri/ui/lib/utils";
import {
  ActivityIcon,
  BabyIcon,
  BookIcon,
  BriefcaseIcon,
  CalendarIcon,
  CarIcon,
  CheckIcon,
  CoffeeIcon,
  DumbbellIcon,
  FilmIcon,
  FuelIcon,
  GamepadIcon,
  GiftIcon,
  GraduationCapIcon,
  HeartIcon,
  HomeIcon,
  MonitorIcon,
  MusicIcon,
  PawPrintIcon,
  PlaneIcon,
  ShirtIcon,
  ShoppingCartIcon,
  SmartphoneIcon,
  SparklesIcon,
  TagIcon,
  UtensilsIcon,
  WalletIcon,
  WifiIcon,
} from "lucide-react";
import * as React from "react";

import { useCategories } from "@/hooks/UseCategories";
import { useEntityForm } from "@/hooks/UseEntityForm";

export const ICON_MAP: Record<string, React.ElementType> = {
  "shopping-cart": ShoppingCartIcon,
  briefcase: BriefcaseIcon,
  coffee: CoffeeIcon,
  car: CarIcon,
  plane: PlaneIcon,
  activity: ActivityIcon,
  home: HomeIcon,
  monitor: MonitorIcon,
  film: FilmIcon,
  gift: GiftIcon,
  book: BookIcon,
  smartphone: SmartphoneIcon,
  wallet: WalletIcon,
  heart: HeartIcon,
  music: MusicIcon,
  utensils: UtensilsIcon,
  shirt: ShirtIcon,
  "graduation-cap": GraduationCapIcon,
  baby: BabyIcon,
  fuel: FuelIcon,
  wifi: WifiIcon,
  gamepad: GamepadIcon,
  "paw-print": PawPrintIcon,
  dumbbell: DumbbellIcon,
  sparkles: SparklesIcon,
  calendar: CalendarIcon,
  tag: TagIcon,
};

export const COLOR_PALETTE = [
  { id: "red", hex: "#ef4444" },
  { id: "orange", hex: "#f97316" },
  { id: "amber", hex: "#f59e0b" },
  { id: "yellow", hex: "#eab308" },
  { id: "lime", hex: "#84cc16" },
  { id: "emerald", hex: "#10b981" },
  { id: "teal", hex: "#14b8a6" },
  { id: "cyan", hex: "#06b6d4" },
  { id: "sky", hex: "#0ea5e9" },
  { id: "blue", hex: "#3b82f6" },
  { id: "indigo", hex: "#6366f1" },
  { id: "violet", hex: "#8b5cf6" },
  { id: "purple", hex: "#a855f7" },
  { id: "pink", hex: "#ec4899" },
  { id: "rose", hex: "#f43f5e" },
  { id: "slate", hex: "#64748b" },
];

interface CreateCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (categoryId: string) => void;
}

export function CreateCategoryDialog({ open, onOpenChange, onCreated }: CreateCategoryDialogProps) {
  const { createMutation } = useCategories();

  const form = useEntityForm({
    initialValues: { name: "", selectedIcon: "shopping-cart", selectedColor: "#3b82f6" },
    validate: (values) => (!values.name.trim() ? "Category name is required" : null),
    onSubmit: async (values) => {
      createMutation.mutate(
        {
          name: values.name.trim(),
          icon: values.selectedIcon,
          color: values.selectedColor,
        },
        {
          onSuccess: (data: Category) => {
            toast.success("Category created!");
            onOpenChange(false);
            if (onCreated && data?.id) {
              onCreated(data.id);
            }
          },
          onError: (err) => {
            toast.error(err.message || "Failed to create category");
          },
        },
      );
    },
  });

  const { reset } = form;

  React.useEffect(() => {
    if (open) {
      reset();
    }
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Custom Category</DialogTitle>
          <DialogDescription>Add a new category to tag your transactions.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Name */}
          <div className="grid gap-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input
              id="cat-name"
              placeholder="e.g. Freelance, Pets, Gaming"
              value={form.values.name}
              onChange={(e) => form.handleChange("name", e.target.value)}
              autoComplete="off"
            />
          </div>

          {/* Preview */}
          {form.values.name.trim() && (
            <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
              <div
                className="flex size-10 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: `${form.values.selectedColor}20`, color: form.values.selectedColor }}
              >
                {(() => {
                  const Icon = ICON_MAP[form.values.selectedIcon] || TagIcon;
                  return <Icon className="size-5" />;
                })()}
              </div>
              <div>
                <p className="text-sm font-medium">{form.values.name.trim()}</p>
                <p className="text-xs text-muted-foreground">Preview</p>
              </div>
            </div>
          )}

          {/* Colors */}
          <div className="grid gap-3">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={cn(
                    "flex size-7 cursor-pointer items-center justify-center rounded-full border-2 transition-all hover:scale-110",
                    form.values.selectedColor === c.hex ? "border-foreground scale-110" : "border-transparent",
                  )}
                  style={{ backgroundColor: c.hex }}
                  onClick={() => form.handleChange("selectedColor", c.hex)}
                  aria-label={`Select ${c.id} color`}
                >
                  {form.values.selectedColor === c.hex && <CheckIcon className="size-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Icons */}
          <div className="grid gap-3">
            <Label>Icon</Label>
            <div className="grid grid-cols-9 gap-1.5 max-h-[180px] overflow-y-auto pr-1">
              {Object.entries(ICON_MAP).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "flex items-center justify-center rounded-md border p-2 transition-all hover:bg-muted",
                    form.values.selectedIcon === key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-transparent text-muted-foreground",
                  )}
                  onClick={() => form.handleChange("selectedIcon", key)}
                  aria-label={`Select ${key} icon`}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit} disabled={!form.values.name.trim() || createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
