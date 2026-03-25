import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authHeaders } from "./use-auth";

export interface Payout {
  id: number;
  serviceId: string;
  providerId: string;
  paymentId?: string | null;
  totalAmount: number;
  platformFee: number;
  providerAmount: number;
  status: "pending" | "paid";
  paidAt?: string | null;
  createdAt?: string | null;
  providerName?: string | null;
  providerEmail?: string | null;
}

export interface ProviderSummary {
  providerId: string;
  providerName?: string | null;
  providerEmail?: string | null;
  totalPending: number;
  totalPaid: number;
  countPending: number;
  countPaid: number;
}

// GET /api/admin/payouts
export function usePayouts(status?: "pending" | "paid" | "all") {
  return useQuery({
    queryKey: ["/api/admin/payouts", status],
    queryFn: async () => {
      let url = "/api/admin/payouts";
      if (status && status !== "all") {
        url += `?status=${status}`;
      }
      
      const res = await fetch(url, { headers: authHeaders() });
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error("Failed to fetch payouts");
      
      const data = await res.json();
      return (data.payouts as Payout[]) || [];
    },
    retry: false,
  });
}

// GET /api/admin/payouts/summary
export function usePayoutsSummary() {
  return useQuery({
    queryKey: ["/api/admin/payouts/summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/payouts/summary", { headers: authHeaders() });
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error("Failed to fetch summary");
      
      const data = await res.json();
      return (data.summary as ProviderSummary[]) || [];
    },
    retry: false,
  });
}

// PUT /api/admin/payouts/:id/paid
export function useMarkPayoutPaid() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/payouts/${id}/paid`, {
        method: "PUT",
        headers: authHeaders(),
      });
      if (res.status === 401) throw new Error("Unauthorized");
      if (!res.ok) throw new Error("Failed to mark as paid");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payouts/summary"] });
    },
  });
}
