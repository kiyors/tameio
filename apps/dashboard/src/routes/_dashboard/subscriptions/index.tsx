import type { JsonValue, Subscription, SubscriptionCycle } from "@keiri/types";
import { Badge } from "@keiri/ui/components/badge";
import { Button } from "@keiri/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@keiri/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@keiri/ui/components/dialog";
import { toast } from "@keiri/ui/components/goey-toaster";
import { Input } from "@keiri/ui/components/input";
import { Label } from "@keiri/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@keiri/ui/components/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@keiri/ui/components/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  BellRingIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  MailIcon,
  SmartphoneIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";

import { useLocalSubscriptionDetection } from "@/hooks/UseWasmLogic";
import { api } from "@/lib/ApiClient";
import { useSession } from "@/lib/AuthClient";

export const Route = createFileRoute("/_dashboard/subscriptions/")({
  component: SubscriptionsComponent,
});

function SubscriptionsComponent() {
  const queryClient = useQueryClient();
  const session = useSession();
  const { detectedSubscriptions, isLoading: isLocalDetecting } = useLocalSubscriptionDetection();

  const { data: confirmedSubs } = useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => api.get<Subscription[]>("/api/subscriptions"),
    enabled: !!session.data,
  });

  const {
    data: potentialSubs,
    isLoading: isDetecting,
    refetch: detect,
  } = useQuery({
    queryKey: ["subscriptions-detect"],
    queryFn: () => api.get<Subscription[]>("/api/subscriptions/detect"),
    enabled: !!session.data,
  });

  const confirmMutation = useMutation({
    mutationFn: (sub: Subscription) =>
      api.post("/api/subscriptions", {
        name: sub.name,
        amount: parseFloat(sub.amount),
        cycle: sub.cycle,
        start_date: sub.start_date,
        next_charge_date: sub.next_charge_date,
        keywords: sub.detection_keywords,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      void queryClient.invalidateQueries({ queryKey: ["subscriptions-detect"] });
      toast.success("Subscription tracked!");
    },
  });

  const stopTrackingMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/subscriptions/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      toast.success("Stopped tracking");
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground text-sm">Manage and track your recurring payments.</p>
        </div>
        <Button onClick={() => detect()} variant="outline" size="sm">
          <SparklesIcon className="mr-2 h-4 w-4" /> Scan for Patterns
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[600px]">
          <TabsTrigger value="active">Active Tracked</TabsTrigger>
          <TabsTrigger value="detected">
            Server Detected
            {potentialSubs && potentialSubs.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-4 px-1.5 min-w-[1.25rem]">
                {potentialSubs.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="local">
            Local WASM
            {detectedSubscriptions && detectedSubscriptions.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-4 px-1.5 min-w-[1.25rem] bg-primary/10 text-primary">
                {detectedSubscriptions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {!confirmedSubs || confirmedSubs.length === 0 ? (
            <Card className="border-dashed py-20">
              <CardContent className="flex flex-col items-center text-center">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold">No tracked subscriptions</h3>
                <p className="text-muted-foreground max-w-xs mt-1">
                  Go to the 'Detected' tab to confirm subscriptions we've found in your transactions.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {confirmedSubs.map((sub) => (
                <SubscriptionCard
                  key={sub.id}
                  sub={sub}
                  isConfirmed
                  onAction={() => stopTrackingMutation.mutate(sub.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="detected" className="mt-6">
          {isDetecting ? (
            <div className="text-center py-20 text-muted-foreground">Scanning transactions for patterns...</div>
          ) : !potentialSubs || potentialSubs.length === 0 ? (
            <Card className="border-dashed py-20">
              <CardContent className="flex flex-col items-center text-center">
                <SparklesIcon className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h3 className="text-lg font-semibold">All caught up</h3>
                <p className="text-muted-foreground max-w-xs mt-1">
                  We haven't detected any new recurring patterns recently.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {potentialSubs.map((sub) => (
                <SubscriptionCard key={sub.id} sub={sub} onAction={() => confirmMutation.mutate(sub)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="local" className="mt-6">
          {isLocalDetecting ? (
            <div className="text-center py-20 text-muted-foreground">WASM is scanning your local history...</div>
          ) : !detectedSubscriptions || detectedSubscriptions.length === 0 ? (
            <Card className="border-dashed py-20">
              <CardContent className="flex flex-col items-center text-center">
                <SparklesIcon className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <h3 className="text-lg font-semibold">No local patterns found</h3>
                <p className="text-muted-foreground max-w-xs mt-1">
                  Try adding more transaction history to help WASM identify recurring payments.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {detectedSubscriptions.map((sub) => (
                <SubscriptionCard
                  key={`local-${sub.name}-${sub.amount}`}
                  sub={
                    {
                      id: `temp-${sub.name}`,
                      name: sub.name,
                      amount: sub.amount,
                      cycle: sub.cycle as SubscriptionCycle,
                      start_date: sub.last_date,
                      next_charge_date: sub.last_date, // Placeholder
                      detection_keywords: [sub.name] as JsonValue,
                    } as Subscription
                  }
                  onAction={() =>
                    confirmMutation.mutate({
                      name: sub.name,
                      amount: sub.amount,
                      cycle: sub.cycle as SubscriptionCycle,
                      start_date: sub.last_date,
                      next_charge_date: sub.last_date,
                      detection_keywords: [sub.name] as JsonValue,
                    } as Subscription)
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SubscriptionCard({
  sub,
  isConfirmed,
  onAction,
}: {
  sub: Subscription;
  isConfirmed?: boolean;
  onAction: () => void;
}) {
  const isMonthly = sub.cycle === "MONTHLY" || (sub.cycle as string) === "monthly";
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  return (
    <Card className="relative overflow-hidden group hover:border-primary/30 transition-colors shadow-sm">
      {isConfirmed && <div className="absolute top-0 left-0 w-1 h-full bg-primary" />}
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-base truncate">{sub.name}</CardTitle>
          <Badge variant={isConfirmed ? "default" : "secondary"} className="text-[10px] h-5">
            {sub.cycle}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {isConfirmed ? "Actively tracking" : "Detected recurring pattern"}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="text-2xl font-bold font-mono tracking-tight">
          ₹{parseFloat(sub.amount).toLocaleString()}
          <span className="text-xs font-normal text-muted-foreground ml-1">/ {isMonthly ? "mo" : "cycle"}</span>
        </div>

        <div className="mt-4 gap-y-2 text-[11px]">
          <div className="flex items-center text-muted-foreground">
            <CalendarIcon className="mr-2 h-3.5 w-3.5" />
            Next billing:{" "}
            <span className="font-medium text-foreground ml-1">
              {new Date(sub.next_charge_date).toLocaleDateString()}
            </span>
          </div>
          {isConfirmed && (
            <div className="flex items-center text-muted-foreground">
              <ClockIcon className="mr-2 h-3.5 w-3.5" />
              Started: {new Date(sub.start_date).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0 flex gap-2">
        {isConfirmed ? (
          <div className="flex flex-col w-full gap-2">
            <div className="flex gap-2">
              <AlertConfigDialog sub={sub} open={isAlertOpen} onOpenChange={setIsAlertOpen} />
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-destructive hover:bg-destructive/5"
                onClick={onAction}
              >
                <Trash2Icon className="h-3.5 w-3.5 mr-2" /> Stop
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button size="sm" className="flex-1" onClick={onAction}>
              <CheckIcon className="h-3.5 w-3.5 mr-2" /> Confirm
            </Button>
            <Button size="sm" variant="ghost" className="flex-1">
              Ignore
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

function AlertConfigDialog({
  sub,
  open,
  onOpenChange,
}: {
  sub: Subscription;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [days, setDays] = useState("3");
  const [channel, setChannel] = useState("EMAIL");

  const alertMutation = useMutation({
    mutationFn: () =>
      api.post(`/api/subscriptions/${sub.id}/alerts`, {
        days_before: parseInt(days, 10),
        channel,
      }),
    onSuccess: () => {
      onOpenChange(false);
      toast.success("Alert configured!");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="flex-1" />}>
        <BellRingIcon className="h-3.5 w-3.5 mr-2" /> Alerts
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configure Alert</DialogTitle>
          <DialogDescription>Get notified before your {sub.name} subscription renews.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="days">Remind me</Label>
            <div className="flex items-center gap-2">
              <Input id="days" type="number" value={days} onChange={(e) => setDays(e.target.value)} className="w-20" />
              <span className="text-sm text-muted-foreground">days before renewal</span>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="channel">Notification Channel</Label>
            <Select value={channel} onValueChange={(val) => setChannel(val || "EMAIL")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                生{" "}
                <SelectItem value="EMAIL">
                  <div className="flex items-center gap-2">
                    <MailIcon className="h-3 w-3" /> Email
                  </div>
                </SelectItem>
                <SelectItem value="PUSH">
                  <div className="flex items-center gap-2">
                    <SmartphoneIcon className="h-3 w-3" /> Push Notification
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => alertMutation.mutate()} disabled={alertMutation.isPending}>
            Save Alert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
