import type { Contact } from "@keiri/types";
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
import * as React from "react";

import { useContacts } from "@/hooks/UseContacts";
import { useEntityForm } from "@/hooks/UseEntityForm";

interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (contactId: string) => void;
}

export function CreateContactDialog({ open, onOpenChange, onCreated }: CreateContactDialogProps) {
  const { createMutation } = useContacts();

  const form = useEntityForm({
    initialValues: { name: "", phone: "" },
    validate: (values) => (!values.name.trim() ? "Contact name is required" : null),
    onSubmit: async (values) => {
      createMutation.mutate(
        {
          name: values.name.trim(),
          phone: values.phone.trim() || undefined,
        },
        {
          onSuccess: (data: Contact) => {
            toast.success("Contact created!");
            onOpenChange(false);
            if (onCreated && data?.id) {
              onCreated(data.id);
            }
          },
          onError: (err) => {
            toast.error(err.message || "Failed to create contact");
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
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Add New Contact</DialogTitle>
          <DialogDescription>Create a new contact to track transactions with them.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="contact-name">Full Name</Label>
            <Input
              id="contact-name"
              placeholder="e.g. John Doe"
              value={form.values.name}
              onChange={(e) => form.handleChange("name", e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-phone">Phone Number (Optional)</Label>
            <Input
              id="contact-phone"
              name="contact-phone"
              placeholder="+91..."
              value={form.values.phone}
              onChange={(e) => form.handleChange("phone", e.target.value)}
              autoComplete="tel"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={form.handleSubmit} disabled={!form.values.name.trim() || createMutation.isPending}>
            {createMutation.isPending ? "Adding..." : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
