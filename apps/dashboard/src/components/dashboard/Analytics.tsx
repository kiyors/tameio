import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@keiri/ui/components/card";
import { BarChart3Icon, TrendingDownIcon, TrendingUpIcon, WalletIcon } from "lucide-react";
import * as React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useLocalSummary, useTransactionSummary } from "@/hooks/UseTransactions";

export function Analytics() {
  const { summary: serverSummary, isLoading: isServerLoading } = useTransactionSummary();
  const { summary: localSummary, isLoading: isLocalLoading } = useLocalSummary();

  const summary = localSummary || serverSummary;
  const isLoading = isLocalLoading && isServerLoading;

  // Weekly income + expense area chart (last 7 days)
  const weeklyData = React.useMemo(() => {
    if (!summary) return [];
    return summary.weekly_trends.map((t) => ({
      name: t.month,
      income: parseFloat(t.income),
      expense: parseFloat(t.expense),
    }));
  }, [summary]);

  if (isLoading && !summary) {
    return (
      <div className="gap-y-4 animate-pulse">
        <div className="h-[400px] bg-muted rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const metrics = {
    totalIncome: parseFloat(summary.monthly_income),
    totalExpense: parseFloat(summary.monthly_spend),
    txnCount: summary.total_transactions,
    avgTxn:
      summary.total_transactions > 0
        ? (parseFloat(summary.monthly_income) + parseFloat(summary.monthly_spend)) / 10
        : 0,
  };

  return (
    <div className="gap-y-4">
      {/* Weekly Trend Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Trend</CardTitle>
          <CardDescription>Income and expenses over the past 7 days</CardDescription>
        </CardHeader>
        <CardContent className="px-6">
          <ResponsiveContainer width="100%" height={300}>
            {/* oxlint-disable jsx-a11y/prefer-tag-over-role */}
            <AreaChart data={weeklyData} role="img" aria-label="Weekly trend area chart">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
              <Tooltip contentStyle={{ borderRadius: "8px" }} />
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorIncome)"
                name="Income"
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorExpense)"
                name="Expense"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Income</CardTitle>
            <TrendingUpIcon className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              ₹
              {metrics.totalIncome.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Earnings this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
            <TrendingDownIcon className="size-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              ₹
              {metrics.totalExpense.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Spending this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <BarChart3Icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.txnCount}</div>
            <p className="text-xs text-muted-foreground">Lifetime recorded</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <WalletIcon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ₹
              {parseFloat(summary.total_balance).toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground">Across all wallets</p>
          </CardContent>
        </Card>
      </div>

      {/* Horizontal Bar Lists */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <Card className="col-span-1 lg:col-span-4">
          <CardHeader>
            <CardTitle>Top Expenses</CardTitle>
            <CardDescription>Highest spending contacts</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarList
              items={summary.top_expenses.map((e) => ({
                name: e.name,
                value: parseFloat(e.amount),
              }))}
              barClass="bg-rose-500"
              valueFormatter={(n) => `₹${n.toLocaleString()}`}
            />
          </CardContent>
        </Card>
        <Card className="col-span-1 lg:col-span-3">
          <CardHeader>
            <CardTitle>Top Income</CardTitle>
            <CardDescription>Highest earning contacts</CardDescription>
          </CardHeader>
          <CardContent>
            <SimpleBarList
              items={summary.top_income.map((e) => ({
                name: e.name,
                value: parseFloat(e.amount),
              }))}
              barClass="bg-emerald-500"
              valueFormatter={(n) => `₹${n.toLocaleString()}`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SimpleBarList({
  items,
  valueFormatter,
  barClass,
}: {
  items: { name: string; value: number }[];
  valueFormatter: (n: number) => string;
  barClass: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">No data yet.</p>;
  }

  return (
    <ul className="gap-y-3">
      {items.map((i) => {
        const width = `${Math.round((i.value / max) * 100)}%`;
        return (
          <li key={`bar-${i.name}`} className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 truncate text-xs text-muted-foreground">{i.name}</div>
              <div className="h-2.5 w-full rounded-full bg-muted">
                <div className={`h-2.5 rounded-full transition-all ${barClass}`} style={{ width }} />
              </div>
            </div>
            <div className="ps-2 text-xs font-medium tabular-nums">{valueFormatter(i.value)}</div>
          </li>
        );
      })}
    </ul>
  );
}
