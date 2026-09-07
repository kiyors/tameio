import type { Category } from "@keiri/types";
import { Button } from "@keiri/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@keiri/ui/components/card";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Input } from "@keiri/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, PlusIcon, TagIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import { api } from "@/lib/ApiClient";

export function CategoriesPanel() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = React.useState("");

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.get<Category[]>("/api/categories"),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post("/api/categories", { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      setNewName("");
      toast.success("Category added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/categories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <TagIcon className="size-5" />
          </div>
          <div>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Manage your custom transaction tags</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="gap-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="New category name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createMutation.mutate(newName)}
          />
          <Button onClick={() => createMutation.mutate(newName)} disabled={!newName || createMutation.isPending}>
            {createMutation.isPending ? (
              <Loader2Icon className="size-4 mr-2 animate-spin" />
            ) : (
              <PlusIcon className="size-4 mr-2" />
            )}{" "}
            Add
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading categories...</p>
          ) : !categories || categories.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No custom categories yet.</p>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center gap-2 px-3 py-1 bg-muted rounded-full border text-sm group"
              >
                <span className="font-medium">{cat.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete category "${cat.name}"?`)) {
                      deleteMutation.mutate(cat.id);
                    }
                  }}
                  aria-label={`Delete category ${cat.name}`}
                  className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none rounded"
                >
                  <Trash2Icon className="size-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
