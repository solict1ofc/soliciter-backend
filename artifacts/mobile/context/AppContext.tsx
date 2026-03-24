import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import React, { useCallback, useEffect, useState } from "react";

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
  /** Saldo disponível para saque (liberado após cliente confirmar) */
  earnings: number;
  /** Total histórico sacado */
  withdrawn: number;
  registered: boolean;
  registration?: ProviderRegistration;
};

const SERVICES_KEY = "servicosapp_services_v2";
const PROVIDER_KEY = "servicosapp_provider_v3";

export const URGENT_FEE = 10;
export const PLATFORM_FEE_RATE = 0.1;

const defaultProvider: ProviderProfile = {
  id: "provider_1",
  name: "",
  rating: 0,
  totalRatings: 0,
  plan: "free",
  activeServiceId: undefined,
  completedJobs: 0,
  earnings: 0,
  withdrawn: 0,
  registered: false,
};

/** Calcula o ganho líquido do prestador em um serviço */
export function calcProviderEarning(service: Service, plan: ProviderPlan): number {
  const fee = plan === "free" ? service.finalValue * PLATFORM_FEE_RATE : 0;
  return service.finalValue - fee;
}

function useAppContextValue() {
  const [services, setServices] = useState<Service[]>([]);
  const [provider, setProvider] = useState<ProviderProfile>(defaultProvider);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [servicesJson, providerJson] = await Promise.all([
        AsyncStorage.getItem(SERVICES_KEY),
        AsyncStorage.getItem(PROVIDER_KEY),
      ]);
      if (servicesJson) setServices(JSON.parse(servicesJson));
      if (providerJson) {
        const saved = JSON.parse(providerJson) as ProviderProfile;
        // Migrate: ensure withdrawn field exists
        setProvider({ withdrawn: 0, ...saved });
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const saveServices = useCallback(async (updated: Service[]) => {
    setServices(updated);
    await AsyncStorage.setItem(SERVICES_KEY, JSON.stringify(updated));
  }, []);

  const saveProvider = useCallback(async (updated: ProviderProfile) => {
    setProvider(updated);
    await AsyncStorage.setItem(PROVIDER_KEY, JSON.stringify(updated));
  }, []);

  // ─── Saldo pendente (em custódia) ─────────────────────────────────────────
  // Calculado dinamicamente: serviços aceitos/em andamento/concluídos aguardando confirmação
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
      const finalValue = data.urgent ? data.value + URGENT_FEE : data.value;
      const newService: Service = {
        id: `svc_${Date.now()}`,
        title: data.title,
        description: data.description,
        baseValue: data.value,
        finalValue,
        city: data.city,
        neighborhood: data.neighborhood,
        urgent: data.urgent,
        priority: data.urgent,
        status: "pending_payment",
        createdAt: new Date().toISOString(),
        chatMessages: [],
      };
      await saveServices([...services, newService]);
      return newService;
    },
    [services, saveServices]
  );

  // ─── 2. Cliente paga → available (valor retido na plataforma) ─────────────
  const confirmPayment = useCallback(
    async (serviceId: string) => {
      const updated = services.map((s) =>
        s.id === serviceId ? { ...s, status: "available" as ServiceStatus } : s
      );
      await saveServices(updated);
    },
    [services, saveServices]
  );

  // ─── 3. Prestador aceita → accepted (valor vai para saldo pendente) ────────
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
      const updated = services.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              status: "in_progress" as ServiceStatus,
              startedAt: new Date().toISOString(),
            }
          : s
      );
      await saveServices(updated);
    },
    [services, saveServices]
  );

  // ─── 5. Prestador finaliza → completed (aguardando confirmação do cliente) ─
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
      await saveServices(updated);
    },
    [services, saveServices]
  );

  // ─── 6. Cliente confirma + avalia → rated ─────────────────────────────────
  // Só aqui o valor sai da custódia e vai para saldo DISPONÍVEL do prestador
  const confirmAndRate = useCallback(
    async (serviceId: string, rating: number) => {
      const service = services.find((s) => s.id === serviceId);
      if (!service) return null;

      const providerEarning = calcProviderEarning(service, provider.plan);
      const fee = provider.plan === "free" ? service.finalValue * PLATFORM_FEE_RATE : 0;

      const totalRatings = provider.totalRatings + 1;
      const newRating =
        (provider.rating * provider.totalRatings + rating) / totalRatings;

      const updated = services.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              status: "rated" as ServiceStatus,
              clientRating: rating,
              ratedAt: new Date().toISOString(),
            }
          : s
      );
      await saveServices(updated);

      // Libera o valor: sai da custódia (pendente) e entra no saldo disponível
      await saveProvider({
        ...provider,
        activeServiceId: undefined,
        completedJobs: provider.completedJobs + 1,
        // earnings = saldo disponível para saque
        earnings: provider.earnings + providerEarning,
        rating: Math.round(newRating * 10) / 10,
        totalRatings,
      });

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
              unreadClient: senderId === "provider"
                ? (s.unreadClient ?? 0) + 1
                : (s.unreadClient ?? 0),
              unreadProvider: senderId === "client"
                ? (s.unreadProvider ?? 0) + 1
                : (s.unreadProvider ?? 0),
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

  const subscribePlan = useCallback(
    async (plan: ProviderPlan) => {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      await saveProvider({ ...provider, plan, planExpiresAt: expiresAt.toISOString() });
    },
    [provider, saveProvider]
  );

  const registerProvider = useCallback(
    async (data: Omit<ProviderRegistration, "registeredAt">) => {
      const registration: ProviderRegistration = {
        ...data,
        registeredAt: new Date().toISOString(),
      };
      await saveProvider({
        ...provider,
        name: data.fullName,
        registered: true,
        registration,
      });
    },
    [provider, saveProvider]
  );

  // ─── Saque: move do saldo disponível para histórico de saques ─────────────
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
    confirmPayment,
    acceptService,
    startService,
    finalizeService,
    confirmAndRate,
    sendMessage,
    markChatRead,
    subscribePlan,
    registerProvider,
    withdrawEarnings,
    PLATFORM_FEE_RATE,
    URGENT_FEE,
  };
}

export const [AppContextProvider, useApp] = createContextHook(useAppContextValue);
