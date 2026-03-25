import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import React, { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useAuth } from "@/context/AuthContext";

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

export type ServiceStatus =
  | "pending_payment"
  | "available"
  | "accepted"
  | "in_progress"
  | "completed"
  | "rated";

export type Service = {
  id: string;
  title: string;
  description: string;
  baseValue: number;
  finalValue: number;
  city: string;
  neighborhood: string;
  urgent: boolean;
  priority: boolean;
  status: ServiceStatus;
  createdAt: string;
  acceptedAt?: string;
  startedAt?: string;
  completedAt?: string;
  ratedAt?: string;
  providerId?: string;
  clientRating?: number;
  providerRating?: number;
  chatMessages?: ChatMessage[];
  unreadClient?: number;
  unreadProvider?: number;
};

export type ChatMessage = {
  id: string;
  senderId: "client" | "provider";
  text: string;
  timestamp: string;
};

export type ProviderPlan = "free" | "basic" | "destaque" | "premium";

export type ProviderRegistration = {
  fullName: string;
  cpf: string;
  birthDate: string;
  phone: string;
  specialty: string;
  city: string;
  neighborhood: string;
  acceptedTerms: boolean;
  registeredAt: string;
};

export type ProviderProfile = {
  id: string;
  name: string;
  rating: number;
  totalRatings: number;
  plan: ProviderPlan;
  planExpiresAt?: string;
  activeServiceId?: string;
  completedJobs: number;
  earnings: number;
  withdrawn: number;
  registered: boolean;
  registration?: ProviderRegistration;
  photoUri?: string;
};

export const URGENT_FEE = 10;
export const PLATFORM_FEE_RATE = 0.1;
export const MP_PAYMENT_FEE = 0.05; // Mercado Pago processing fee (~5%)
/** Gross-up a net amount to cover the MP fee; what the client actually pays. */
export const mpGrossUp = (net: number) =>
  Math.round((net / (1 - MP_PAYMENT_FEE)) * 100) / 100;

const makeDefaultProvider = (userId: string): ProviderProfile => ({
  id: `provider_${userId}`,
  name: "",
  rating: 0,
  totalRatings: 0,
  plan: "free",
  activeServiceId: undefined,
  completedJobs: 0,
  earnings: 0,
  withdrawn: 0,
  registered: false,
});

/** Calcula o ganho líquido do prestador em um serviço */
export function calcProviderEarning(service: Service, plan: ProviderPlan): number {
  const fee = plan === "free" ? service.finalValue * PLATFORM_FEE_RATE : 0;
  return service.finalValue - fee;
}

function useAppContextValue() {
  const { user } = useAuth();

  // Storage keys scoped to the logged-in user — each user sees only their own data
  const userId = user?.id?.toString() ?? "guest";
  const SERVICES_KEY = `servicosapp_services_v2_${userId}`;
  const PROVIDER_KEY = `servicosapp_provider_v3_${userId}`;

  const [services, setServices] = useState<Service[]>([]);
  const [provider, setProvider] = useState<ProviderProfile>(makeDefaultProvider(userId));
  const [loading, setLoading] = useState(true);

  // Reload data whenever the logged-in user changes (login / logout)
  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [servicesJson, providerJson] = await Promise.all([
        AsyncStorage.getItem(SERVICES_KEY),
        AsyncStorage.getItem(PROVIDER_KEY),
      ]);
      const loaded: Service[] = servicesJson ? JSON.parse(servicesJson) : [];
      setServices(loaded);
      if (providerJson) {
        const saved = JSON.parse(providerJson) as ProviderProfile;
        setProvider({ ...saved, withdrawn: saved.withdrawn ?? 0 });
      } else {
        setProvider(makeDefaultProvider(userId));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const saveServices = useCallback(
    async (updated: Service[]) => {
      setServices(updated);
      await AsyncStorage.setItem(SERVICES_KEY, JSON.stringify(updated));
    },
    [SERVICES_KEY]
  );

  const saveProvider = useCallback(
    async (updated: ProviderProfile) => {
      setProvider(updated);
      await AsyncStorage.setItem(PROVIDER_KEY, JSON.stringify(updated));
    },
    [PROVIDER_KEY]
  );

  // ─── Saldo pendente (em custódia) ─────────────────────────────────────────
  const pendingEarnings = services
    .filter(
      (s) =>
        s.providerId === provider.id &&
        (s.status === "accepted" || s.status === "in_progress" || s.status === "completed")
    )
    .reduce((sum, s) => sum + calcProviderEarning(s, provider.plan), 0);

  // ─── 1. Cliente cria serviço → pending_payment ────────────────────────────
  const createService = useCallback(
    async (data: {
      title: string;
      description: string;
      value: number;
      city: string;
      neighborhood: string;
      urgent: boolean;
    }) => {
      const isPremium = user?.isPremium ?? false;
      const isUrgent = isPremium ? true : data.urgent;
      const urgencyFee = isPremium ? 0 : (data.urgent ? URGENT_FEE : 0);
      const finalValue = data.value + urgencyFee;

      const newService: Service = {
        id: `svc_${Date.now()}`,
        title: data.title,
        description: data.description,
        baseValue: data.value,
        finalValue,
        city: data.city,
        neighborhood: data.neighborhood,
        urgent: isUrgent,
        priority: isUrgent,
        status: "pending_payment",
        createdAt: new Date().toISOString(),
        chatMessages: [],
      };
      await saveServices([...services, newService]);
      return newService;
    },
    [services, saveServices, user]
  );

  // ─── 1b. Cliente cria pagamento PIX (vai para conta da plataforma) ─────────
  const createPayment = useCallback(
    async (serviceId: string, amountInCents: number, title: string) => {
      const res = await fetch(`${API_BASE}/payment/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          amountInCents,
          title,
          userEmail: user?.email || "cliente@solicite.app",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Falha ao criar pagamento PIX");
      }
      return await res.json() as {
        paymentId: string;
        qrCode: string;
        pixCode: string;
        isTestMode: boolean;
      };
    },
    [user]
  );

  // ─── 2. Pagamento confirmado → available ──────────────────────────────────
  const confirmPayment = useCallback(
    async (serviceId: string) => {
      const updated = services.map((s) =>
        s.id === serviceId ? { ...s, status: "available" as ServiceStatus } : s
      );
      await saveServices(updated);
    },
    [services, saveServices]
  );

  // ─── 2b. Cancelar serviço com pagamento pendente ──────────────────────────
  const cancelPendingService = useCallback(
    async (serviceId: string) => {
      const updated = services.filter((s) => s.id !== serviceId);
      await saveServices(updated);
    },
    [services, saveServices]
  );

  // ─── 3. Prestador aceita → accepted ───────────────────────────────────────
  const acceptService = useCallback(
    async (serviceId: string) => {
      if (provider.activeServiceId) return false;
      const updated = services.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              status: "accepted" as ServiceStatus,
              acceptedAt: new Date().toISOString(),
              providerId: provider.id,
            }
          : s
      );
      await saveServices(updated);
      await saveProvider({ ...provider, activeServiceId: serviceId });
      return true;
    },
    [services, provider, saveServices, saveProvider]
  );

  // ─── 4. Prestador inicia → in_progress ────────────────────────────────────
  const startService = useCallback(
    async (serviceId: string) => {
      const startedAt = new Date().toISOString();
      const updated = services.map((s) =>
        s.id === serviceId
          ? { ...s, status: "in_progress" as ServiceStatus, startedAt }
          : s
      );
      // Update local state first — UI responds immediately
      await saveServices(updated);

      // Best-effort API call — failure does NOT revert local state
      fetch(`${API_BASE}/iniciar-servico`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      }).catch(() => {
        // Silently ignore network errors — local state is the source of truth
      });
    },
    [services, saveServices]
  );

  // ─── 5. Prestador finaliza → completed ────────────────────────────────────
  const finalizeService = useCallback(
    async (serviceId: string) => {
      const updated = services.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              status: "completed" as ServiceStatus,
              completedAt: new Date().toISOString(),
            }
          : s
      );
      // Update local state first — UI responds immediately
      await saveServices(updated);

      // Best-effort API call — failure does NOT revert local state
      fetch(`${API_BASE}/finalizar-servico`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId }),
      }).catch(() => {
        // Silently ignore network errors — local state is the source of truth
      });
    },
    [services, saveServices]
  );

  // ─── 6. Cliente confirma e avalia → rated + libera pagamento ─────────────
  const confirmAndRate = useCallback(
    async (serviceId: string, rating: number) => {
      const service = services.find((s) => s.id === serviceId);
      if (!service) return null;

      const providerEarning = calcProviderEarning(service, provider.plan);
      const fee = provider.plan === "free" ? service.finalValue * PLATFORM_FEE_RATE : 0;

      const hasRating = rating > 0;
      const totalRatings = hasRating ? provider.totalRatings + 1 : provider.totalRatings;
      const newRating = hasRating
        ? (provider.rating * provider.totalRatings + rating) / totalRatings
        : provider.rating;

      const updated = services.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              status: "rated" as ServiceStatus,
              ...(hasRating ? { clientRating: rating } : {}),
              ratedAt: new Date().toISOString(),
            }
          : s
      );
      await saveServices(updated);

      await saveProvider({
        ...provider,
        activeServiceId: undefined,
        completedJobs: provider.completedJobs + 1,
        earnings: provider.earnings + providerEarning,
        rating: Math.round(newRating * 10) / 10,
        totalRatings,
      });

      // Liberar pagamento retido → 90% prestador / 10% plataforma (melhor esforço)
      fetch(`${API_BASE}/payment/release/${serviceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerId: service.providerId }),
      }).catch(() => {});

      return { fee, providerEarning, platformFeeApplied: provider.plan === "free" };
    },
    [services, provider, saveServices, saveProvider]
  );

  const sendMessage = useCallback(
    async (serviceId: string, text: string, senderId: "client" | "provider") => {
      const msg: ChatMessage = {
        id: `msg_${Date.now()}`,
        senderId,
        text,
        timestamp: new Date().toISOString(),
      };
      const updated = services.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              chatMessages: [...(s.chatMessages ?? []), msg],
              unreadClient:
                senderId === "provider" ? (s.unreadClient ?? 0) + 1 : (s.unreadClient ?? 0),
              unreadProvider:
                senderId === "client" ? (s.unreadProvider ?? 0) + 1 : (s.unreadProvider ?? 0),
            }
          : s
      );
      await saveServices(updated);
    },
    [services, saveServices]
  );

  const markChatRead = useCallback(
    async (serviceId: string, role: "client" | "provider") => {
      const updated = services.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              unreadClient: role === "client" ? 0 : s.unreadClient,
              unreadProvider: role === "provider" ? 0 : s.unreadProvider,
            }
          : s
      );
      await saveServices(updated);
    },
    [services, saveServices]
  );

  const activatePlan = useCallback(
    async (plan: ProviderPlan) => {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      await saveProvider({ ...provider, plan, planExpiresAt: expiresAt.toISOString() });
    },
    [provider, saveProvider]
  );

  const registerProvider = useCallback(
    async (data: Omit<ProviderRegistration, "registeredAt">) => {
      const registration: ProviderRegistration = { ...data, registeredAt: new Date().toISOString() };
      await saveProvider({
        ...provider,
        name: data.fullName,
        registered: true,
        registration,
      });
    },
    [provider, saveProvider]
  );

  const withdrawEarnings = useCallback(
    async (amount: number) => {
      if (amount > provider.earnings) return false;
      await saveProvider({
        ...provider,
        earnings: provider.earnings - amount,
        withdrawn: (provider.withdrawn ?? 0) + amount,
      });
      return true;
    },
    [provider, saveProvider]
  );

  /** Zera earnings e withdrawn (uso exclusivo para resetar dados de teste) */
  const resetProviderBalance = useCallback(async () => {
    await saveProvider({ ...provider, earnings: 0, withdrawn: 0 });
  }, [provider, saveProvider]);

  const savePhoto = useCallback(
    async (uri: string) => {
      await saveProvider({ ...provider, photoUri: uri });
    },
    [provider, saveProvider]
  );

  const availableServices = services.filter((s) => s.status === "available");
  const activeService = provider.activeServiceId
    ? services.find((s) => s.id === provider.activeServiceId)
    : undefined;

  return {
    services,
    availableServices,
    activeService,
    provider,
    pendingEarnings,
    loading,
    createService,
    createPayment,
    confirmPayment,
    cancelPendingService,
    acceptService,
    startService,
    finalizeService,
    confirmAndRate,
    sendMessage,
    markChatRead,
    activatePlan,
    registerProvider,
    withdrawEarnings,
    resetProviderBalance,
    savePhoto,
    PLATFORM_FEE_RATE,
    URGENT_FEE,
  };
}

export const [AppContextProvider, useApp] = createContextHook(useAppContextValue);
