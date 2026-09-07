import type { Budget, Category, Contact, PaginatedTransactions, Transaction, Wallet } from "@keiri/types";
import {
  BrowserCollectionCoordinator,
  createBrowserWASQLitePersistence,
  openBrowserWASQLiteOPFSDatabase,
  persistedCollectionOptions,
} from "@tanstack/browser-db-sqlite-persistence";
import { BTreeIndex, createCollection } from "@tanstack/db";

import { api } from "./ApiClient";

// In @tanstack/db v0.6.5, we export an object with collections.
// We use localStorageCollectionOptions to handle persistence and cross-tab sync.

// Initialize WA-SQLite persistence
const database = await openBrowserWASQLiteOPFSDatabase({
  databaseName: "keiri_dashboard.sqlite",
});

const coordinator = new BrowserCollectionCoordinator({
  dbName: "keiri_dashboard",
});

const persistence = createBrowserWASQLitePersistence({
  database,
  coordinator,
});

const walletOptions = persistedCollectionOptions({
  id: "keiri_wallets",
  getKey: (wallet: Wallet) => wallet.id,
  persistence,
  schemaVersion: 1,
});

const transactionsOptions = persistedCollectionOptions({
  id: "keiri_transactions",
  getKey: (txn: Transaction) => txn.id,
  defaultIndexType: BTreeIndex,
  persistence,
  schemaVersion: 1,
});

const budgetOptions = persistedCollectionOptions({
  id: "keiri_budgets",
  getKey: (budget: Budget) => budget.id,
  persistence,
  schemaVersion: 1,
});

const categoryOptions = persistedCollectionOptions({
  id: "keiri_categories",
  getKey: (cat: Category) => cat.id,
  persistence,
  schemaVersion: 1,
});

const contactOptions = persistedCollectionOptions({
  id: "keiri_contacts",
  getKey: (contact: Contact) => contact.id,
  persistence,
  schemaVersion: 1,
});

export const db = {
  wallets: createCollection({
    ...walletOptions,
    sync: {
      sync: (params) => {
        walletOptions.sync.sync(params);
        api
          .get<Wallet[]>("/api/wallets")
          .then((wallets) => {
            params.begin();
            for (const wallet of wallets) {
              const type = params.collection.has(wallet.id) ? "update" : "insert";
              params.write({ type, value: wallet });
            }
            params.commit();
          })
          .catch((error) => console.error("Failed to sync wallets:", error));
      },
    },
  }),
  transactions: createCollection({
    ...transactionsOptions,
    sync: {
      sync: (params) => {
        transactionsOptions.sync.sync(params);
        api
          .get<PaginatedTransactions>("/api/transactions?limit=30")
          .then((res) => {
            params.begin();
            for (const txn of res.items) {
              const type = params.collection.has(txn.id) ? "update" : "insert";
              params.write({ type, value: txn });
            }
            params.commit();
          })
          .catch((error) => console.error("Failed to sync transactions:", error));
      },
    },
  }),
  budgets: createCollection({
    ...budgetOptions,
    sync: {
      sync: (params) => {
        budgetOptions.sync.sync(params);
        api
          .get<Budget[]>("/api/budgets")
          .then((budgets) => {
            params.begin();
            for (const budget of budgets) {
              const type = params.collection.has(budget.id) ? "update" : "insert";
              params.write({ type, value: budget });
            }
            params.commit();
          })
          .catch((error) => console.error("Failed to sync budgets:", error));
      },
    },
  }),
  categories: createCollection({
    ...categoryOptions,
    sync: {
      sync: (params) => {
        categoryOptions.sync.sync(params);
        api
          .get<Category[]>("/api/categories")
          .then((categories) => {
            params.begin();
            for (const cat of categories) {
              const type = params.collection.has(cat.id) ? "update" : "insert";
              params.write({ type, value: cat });
            }
            params.commit();
          })
          .catch((error) => console.error("Failed to sync categories:", error));
      },
    },
  }),
  contacts: createCollection({
    ...contactOptions,
    sync: {
      sync: (params) => {
        contactOptions.sync.sync(params);
        api
          .get<Contact[]>("/api/contacts")
          .then((contacts) => {
            params.begin();
            for (const contact of contacts) {
              const type = params.collection.has(contact.id) ? "update" : "insert";
              params.write({ type, value: contact });
            }
            params.commit();
          })
          .catch((error) => console.error("Failed to sync contacts:", error));
      },
    },
  }),
};

// Add explicit index for performance
db.transactions.createIndex((row) => row.date);
