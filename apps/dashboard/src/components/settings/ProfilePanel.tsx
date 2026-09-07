import type { User } from "@keiri/types";
import { Avatar, AvatarFallback, AvatarImage } from "@keiri/ui/components/avatar";
import { Badge } from "@keiri/ui/components/badge";
import { Button } from "@keiri/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@keiri/ui/components/card";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, Loader2Icon, UploadIcon, UserIcon } from "lucide-react";
import * as React from "react";

import { api } from "@/lib/ApiClient";

export function ProfilePanel({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [name, setName] = React.useState(user?.name || "");
  const [username, setUsername] = React.useState(user?.username || "");
  const [isUploading, setIsUploading] = React.useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; username?: string | null; image?: string | null }) =>
      api.put("/api/users/profile", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session"] }); // Better Auth usually stores session in cache
      toast.success("Profile updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:7878";
      const uploadRes = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadRes.ok) throw new Error("Upload failed");
      const { key } = await uploadRes.json();

      // Update profile with new image key/url
      const bucketName = "keiri-uploads"; // Should match backend
      const imageUrl = `https://${bucketName}.r2.cloudflarestorage.com/${key}`;

      await updateMutation.mutateAsync({ image: imageUrl });
      toast.success("Avatar updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to upload avatar");
    } finally {
      setIsUploading(false);
    }
  };

  const isDirty = name !== user?.name || username !== (user?.username || "");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserIcon className="size-5" />
          </div>
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manage your public identity and avatar</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="gap-y-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 pb-2">
          <div className="relative group">
            <Avatar className="size-24 border-2 border-muted">
              <AvatarImage src={user?.image ?? undefined} />
              <AvatarFallback className="bg-primary/5 text-primary text-2xl">
                {user?.name?.charAt(0) || user?.email?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <UploadIcon className="text-white size-6" />
              <input
                type="file"
                className="absolute inset-0 opacity-0 cursor-pointer"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={isUploading}
              />
            </div>
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-full">
                <Loader2Icon className="animate-spin text-white size-6" />
              </div>
            )}
          </div>
          <div className="flex-1 gap-y-1 text-center sm:text-left">
            <h3 className="font-semibold text-lg">{user?.name || "Member"}</h3>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
              {user?.email_verified ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1 px-2">
                  <CheckIcon className="size-3" /> Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                  Unverified
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="gap-y-2">
            <Label htmlFor="full-name">Full Name</Label>
            <Input id="full-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="gap-y-2">
            <Label htmlFor="username">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@handle" />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={() => updateMutation.mutate({ name, username })}
            disabled={!isDirty || updateMutation.isPending}
          >
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
