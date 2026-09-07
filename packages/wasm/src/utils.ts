import type {
  AggregatedMetrics,
  BatchMatchResult,
  BudgetPeriod,
  Category,
  DashboardSummary,
  DetectedSubscription,
  FuzzySearchResult,
  SavingsProjection,
  SearchableItem,
  SpendingVelocity,
  StatementRowMinimal,
  TransactionMinimal,
  Txn,
  TxnPattern,
  Wallet,
} from "@keiri/types";

import * as wasm from "../pkg/wasm";

export function loadKeiriWasm() {
  return wasm;
}

export function calculateBudgetPercentageWasm(spent: string, limit: string): string | undefined {
  return wasm.calculate_budget_percentage(spent, limit);
}

export function isTransactionInPeriodWasm(txnDate: string | number | Date, period: BudgetPeriod) {
  const date = new Date(txnDate);
  return wasm.is_transaction_in_period(BigInt(date.getTime()), period);
}

export function calculateSpendingVelocityWasm(spent: string, limit: string, period: string) {
  return wasm.calculate_spending_velocity(spent, limit, period) as SpendingVelocity | undefined;
}

export function projectSavingsGoalWasm(
  currentBalance: string,
  targetAmount: string,
  monthlyIncome: string,
  monthlyExpenses: string,
) {
  return wasm.project_savings_goal(currentBalance, targetAmount, monthlyIncome, monthlyExpenses) as
    | SavingsProjection
    | undefined;
}

export function normalizeTextWasm(text: string) {
  return wasm.normalize_text(text);
}

export function phoneticEncodeWasm(text: string) {
  return wasm.phonetic_encode(text);
}

export function fuzzyScoreWasm(a: string, b: string) {
  return wasm.fuzzy_score(a, b);
}

export function calculateMatchScoreWasm(
  rowDate: string | number | Date,
  rowDesc: string,
  rowAmount: string,
  txnDate: string | number | Date,
  txnDesc: string,
  txnAmount: string,
) {
  return wasm.calculate_match_score(
    BigInt(new Date(rowDate).getTime()),
    rowDesc,
    rowAmount,
    BigInt(new Date(txnDate).getTime()),
    txnDesc,
    txnAmount,
  );
}

export function matchStatementBatchWasm(statementRows: StatementRowMinimal[], transactions: TransactionMinimal[]) {
  return wasm.match_statement_batch(statementRows, transactions) as BatchMatchResult[];
}

export function batchFuzzySearchWasm(query: string, items: string[], threshold: number = 0.5) {
  return wasm.batch_fuzzy_search(query, items, threshold) as FuzzySearchResult[];
}

export function advancedFuzzySearchWasm(query: string, items: SearchableItem[], threshold: number = 0.5) {
  return wasm.advanced_fuzzy_search(query, items, threshold) as FuzzySearchResult[];
}

export function parseNumericLikeWasm(input: string) {
  return wasm.parse_numeric_like(input);
}

export function aggregateTransactionsWasm(transactions: Txn[]) {
  return wasm.aggregate_transactions(transactions) as AggregatedMetrics;
}

export function generateDashboardSummaryWasm(transactions: Txn[], wallets: Wallet[], categories: Category[]) {
  return wasm.generate_dashboard_summary(transactions, wallets, categories) as DashboardSummary;
}

export function detectSubscriptionPatternsWasm(transactions: TxnPattern[]) {
  return wasm.detect_subscription_patterns(transactions) as DetectedSubscription[];
}

export function parseCsvToWasm(data: Uint8Array) {
  return wasm.parse_csv_to_json(data);
}

export function parseExcelToWasm(data: Uint8Array) {
  return wasm.parse_excel_to_json(data);
}

export function validateTransactionWasm(amount: string, purpose: string) {
  return wasm.validate_transaction_wasm(amount, purpose);
}

export function validateBudgetWasm(amount: string) {
  return wasm.validate_budget_wasm(amount);
}

export function validateWalletWasm(name: string, balance: string) {
  return wasm.validate_wallet_wasm(name, balance);
}

export function validateContactWasm(name: string) {
  return wasm.validate_contact_wasm(name);
}

export function validateUpiIdWasm(upiId: string) {
  return wasm.validate_upi_id_wasm(upiId);
}

export function validateEmailWasm(email: string) {
  return wasm.validate_email_wasm(email);
}

export function validatePhoneWasm(phone: string) {
  return wasm.validate_phone_wasm(phone);
}

export function formatCurrencyWasm(amount: string, currencyCode: string): string | undefined {
  return wasm.format_currency(amount, currencyCode);
}

export function detectCurrencyFromTextWasm(text: string): string | undefined {
  return wasm.detect_currency_from_text(text);
}
