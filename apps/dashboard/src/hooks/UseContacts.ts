import type {
  AddIdentifierRequest,
  Contact,
  ContactDetail,
  ContactIdentifier,
  CreateContactRequest,
  MergeContactsRequest,
  UpdateContactRequest,
  ValidationResult,
} from "@keiri/types";
import { toast } from "@keiri/ui/components/goey-toaster";
import { validateContactWasm, validatePhoneWasm, validateUpiIdWasm } from "@keiri/wasm";
import { useLiveQuery } from "@tanstack/react-db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/ApiClient";
import { useSession } from "@/lib/AuthClient";
import { db } from "@/lib/Db";

/**
 * Run an awaited wasm validator and throw a flat user-facing message if the
 * result reports any errors. Pass-through helper so the create/update/identifier
 * mutations share one shape.
 */
async function assertValid(promise: Promise<unknown>): Promise<void> {
  const result = (await promise) as ValidationResult;
  if (result && !result.is_valid) {
    throw new Error(result.errors.map((e) => `${e.field}: ${e.message}`).join(", "));
  }
}

export function useContacts(options?: { enabled?: boolean }) {
  const session = useSession();

  const query = useLiveQuery((q) => q.from({ contacts: db.contacts }), [session.data]);

  const createMutation = useMutation({
    mutationFn: async (data: CreateContactRequest) => {
      // 0. Shared WASM Validation — name is required, phone is optional.
      await assertValid(validateContactWasm(data.name));
      if (data.phone) {
        await assertValid(validatePhoneWasm(data.phone));
      }
      return api.post<Contact, CreateContactRequest>("/api/contacts", data);
    },
    onSuccess: (newContact) => {
      db.contacts.insert(newContact);
      toast.success("Contact added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateContactRequest }) => {
      // 0. Shared WASM Validation — both fields are optional on update.
      if (data.name) {
        await assertValid(validateContactWasm(data.name));
      }
      if (data.phone) {
        await assertValid(validatePhoneWasm(data.phone));
      }
      return api.put<Contact, UpdateContactRequest>(`/api/contacts/${id}`, data);
    },
    onMutate: async ({ id, data }) => {
      const previousContact = db.contacts.get(id);

      db.contacts.update(id, (draft) => {
        Object.assign(draft, data);
      });

      return { previousContact };
    },
    onError: (err, { id }, context) => {
      if (context?.previousContact) {
        db.contacts.update(id, (draft) => {
          Object.assign(draft, context.previousContact);
        });
      }
      toast.error(err.message);
    },
    onSuccess: (updatedContact, { id }) => {
      db.contacts.update(id, (draft) => {
        Object.assign(draft, updatedContact);
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/contacts/${id}`),
    onMutate: async (id) => {
      const previousContact = db.contacts.get(id);
      db.contacts.delete(id);
      return { previousContact };
    },
    onError: (err, _id, context) => {
      if (context?.previousContact) {
        db.contacts.insert(context.previousContact);
      }
      toast.error(err.message);
    },
    onSuccess: () => {
      toast.success("Contact removed");
    },
  });

  return {
    contacts: (options?.enabled === false ? [] : query.data) as unknown as Contact[],
    isLoading: query.isLoading,
    error: query.isError ? "Error loading contacts" : null,
    createMutation,
    updateMutation,
    deleteMutation,
  };
}

export function useMergeContacts() {
  const session = useSession();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["contacts-suggestions"],
    queryFn: () => api.get<{ contacts: Contact[]; reason: string }[]>("/api/contacts/suggestions"),
    enabled: !!session.data,
  });

  const mergeMutation = useMutation({
    mutationFn: (data: MergeContactsRequest) => api.post<Contact, MergeContactsRequest>("/api/contacts/merge", data),
    onSuccess: async (_, variables) => {
      try {
        // Sync local DB
        const primary = await api.get<ContactDetail>(`/api/contacts/${variables.primary_id}`);
        db.contacts.update(variables.primary_id, (draft) => Object.assign(draft, primary));
        db.contacts.delete(variables.secondary_id);
      } catch (e) {
        console.error("Failed to sync contacts after merge", e);
      }
      void queryClient.invalidateQueries({ queryKey: ["contacts-suggestions"] });
      void queryClient.invalidateQueries({ queryKey: ["contact-detail", variables.primary_id] });
      toast.success("Contacts merged successfully");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    suggestions: query.data,
    isLoading: query.isLoading,
    error: query.error,
    mergeMutation,
  };
}

export function useContactDetail(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["contact-detail", id],
    queryFn: () => api.get<ContactDetail>(`/api/contacts/${id}`),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const addIdentifierMutation = useMutation({
    mutationFn: async (data: AddIdentifierRequest) => {
      // Validate UPI / phone before round-tripping. BANK_ACC has no shared
      // wasm validator yet; the server-side validator still applies.
      if (data.type === "UPI") {
        await assertValid(validateUpiIdWasm(data.value));
      } else if (data.type === "PHONE") {
        await assertValid(validatePhoneWasm(data.value));
      }
      return api.post<ContactIdentifier, AddIdentifierRequest>(`/api/contacts/${id}/identifiers`, data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["contact-detail", id] });
      toast.success("Identifier added");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return {
    contactData: query.data,
    isLoading: query.isLoading,
    addIdentifierMutation,
  };
}
