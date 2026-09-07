import type { User } from "@keiri/types";
import { Avatar, AvatarFallback, AvatarImage } from "@keiri/ui/components/avatar";
import { Button } from "@keiri/ui/components/button";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { Separator } from "@keiri/ui/components/separator";
import { createFileRoute } from "@tanstack/react-router";
import { CameraIcon, LoaderIcon } from "lucide-react";
import * as React from "react";

import { api } from "@/lib/ApiClient";
import { useSession } from "@/lib/AuthClient";

export const Route = createFileRoute("/_dashboard/settings/profile")({
  component: SettingsProfilePage,
});

type ProfileState = {
  avatarPreview: string | null;
  isUploading: boolean;
  name: string;
  username: string;
  email: string;
  isSaving: boolean;
};

type ProfileAction =
  | { type: "SET_FIELD"; field: keyof ProfileState; value: string | boolean | null }
  | { type: "SET_USER_DATA"; user: User };

function profileReducer(state: ProfileState, action: ProfileAction): ProfileState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_USER_DATA":
      return {
        ...state,
        name: action.user.name || "",
        username: action.user.username || "",
        email: action.user.email || "",
        avatarPreview: action.user.image || null,
      };
    default:
      return state;
  }
}

function SettingsProfilePage() {
  const session = useSession();
  const user = session.data?.user;

  const [state, dispatch] = React.useReducer(profileReducer, {
    avatarPreview: null,
    isUploading: false,
    name: "",
    username: "",
    email: "",
    isSaving: false,
  });

  const { avatarPreview, isUploading, name, username, email, isSaving } = state;

  // Populate form fields when session loads
  React.useEffect(() => {
    if (user) {
      // The session user from better-auth carries extra runtime fields the
      // shared @keiri/types User doesn't model (oauth provider scopes, etc.);
      // route through `unknown` so the reducer still gets a structurally
      // compatible value without a blanket `any`.
      dispatch({ type: "SET_USER_DATA", user: user as unknown as User });
    }
  }, [user]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }

    // Validate file size (max 5MB, will be compressed server-side)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB.");
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      dispatch({ type: "SET_FIELD", field: "avatarPreview", value: reader.result as string });
    };
    reader.readAsDataURL(file);

    // Upload to R2 via the avatar endpoint
    dispatch({ type: "SET_FIELD", field: "isUploading", value: true });
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await api.post<{ url: string; key: string }>("/api/users/avatar", formData);
      dispatch({ type: "SET_FIELD", field: "avatarPreview", value: result.url });

      // Refetch session so the new avatar URL propagates to NavUser & everywhere else
      await session.refetch();

      toast.success("Avatar updated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar");
      // Revert preview to session avatar on failure
      dispatch({ type: "SET_FIELD", field: "avatarPreview", value: user?.image || null });
    } finally {
      dispatch({ type: "SET_FIELD", field: "isUploading", value: false });
    }
  };

  const handleSave = async () => {
    dispatch({ type: "SET_FIELD", field: "isSaving", value: true });
    try {
      await api.put("/api/users/profile", {
        name: name || undefined,
        username: username || undefined,
      });
      await session.refetch();
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      dispatch({ type: "SET_FIELD", field: "isSaving", value: false });
    }
  };

  return (
    <div className="gap-y-6 w-full max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold">Profile</h3>
        <p className="text-sm text-muted-foreground">This is how others will see you on the site.</p>
      </div>
      <Separator />
      <div className="gap-y-8">
        {/* Profile Picture */}
        <div className="gap-y-2">
          <Label>Profile Picture</Label>
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="size-20">
                <AvatarImage src={avatarPreview || undefined} alt="Profile picture" />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {user?.name?.charAt(0) ?? "U"}
                </AvatarFallback>
              </Avatar>
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {isUploading ? (
                  <LoaderIcon className="size-5 text-white animate-spin" />
                ) : (
                  <CameraIcon className="size-5 text-white" />
                )}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleAvatarChange}
                disabled={isUploading}
              />
            </div>
            <div className="gap-y-1">
              <p className="text-sm font-medium">Upload a new avatar</p>
              <p className="text-[0.8rem] text-muted-foreground">JPG, PNG or GIF. Max 5MB. Auto-compressed to WebP.</p>
              <label
                htmlFor="avatar-upload"
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 cursor-pointer transition-colors"
              >
                {isUploading ? "Uploading…" : "Choose File"}
              </label>
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="gap-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "name", value: e.target.value })}
            placeholder="Your name"
          />
        </div>

        {/* Username */}
        <div className="gap-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => dispatch({ type: "SET_FIELD", field: "username", value: e.target.value })}
            placeholder="keiri_user"
          />
          <p className="text-[0.8rem] text-muted-foreground">
            This is your public display name. It can be your real name or a pseudonym.
          </p>
        </div>

        {/* Email */}
        <div className="gap-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={email} disabled className="opacity-60" />
          <p className="text-[0.8rem] text-muted-foreground">
            Email cannot be changed from this page. Contact support to update your email.
          </p>
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Update profile"}
        </Button>
      </div>
    </div>
  );
}
