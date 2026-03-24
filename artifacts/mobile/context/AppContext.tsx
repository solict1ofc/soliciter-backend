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
  // Unread counters: messages the role hasn't seen yet
  unreadClient?: number;   // new messages FROM provider, not yet seen by client
  unreadProvider?: number; // new messages FROM client, not yet seen by provider
};

export type ChatMessage = {
  id: string;
  senderId: "client" | "provider";
  text: string;
  timestamp: string;
};

export type ProviderPlan = "free" | "basic" | "premium";

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
};

const SERVICES_KEY = "servicosapp_services_v2";
const PROVIDER_KEY = "servicosapp_provider_v2";

export const URGENT_FEE = 10;
export const PLATFORM_FEE_RATE = 0.1;

const defaultProvider: ProviderProfile = {
  id: "provider_1",
  name: "João Silva",
  rating: 4.8,
  totalRatings: 127,
  plan: "free",
  activeServiceId: undefined,
  completedJobs: 47,
  earnings: 3240.5,
};

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
      if (providerJson) setProvider(JSON.parse(providerJson));
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

  // 1. Client creates service → status = pending_payment
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
        status: "pending_payment",
        createdAt: new Date().toISOString(),
        chatMessages: [],
      };
      await saveServices([...services, newService]);
      return newService;
    },
    [services, saveServices]
  );

  // 2. Client pays → status = available (appears in Global)
  const confirmPayment = useCallback(
    async (serviceId: string) => {
      const updated = services.map((s) =>
        s.id === serviceId ? { ...s, status: "available" as ServiceStatus } : s
      );
      await saveServices(updated);
    },
    [services, saveServices]
  );

  // 3. Provider accepts → status = accepted
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

  // 4. Provider starts work → status = in_progress
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

  // 5. Provider finalizes → status = completed
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

  // 6. Client confirms payment + rates provider → status = rated (applies 10% fee)
  const confirmAndRate = useCallback(
    async (serviceId: string, rating: number) => {
      const service = services.find((s) => s.id === serviceId);
      if (!service) return null;

      const fee =
        provider.plan === "free"
          ? service.finalValue * PLATFORM_FEE_RATE
          : 0;
      const providerEarning = service.finalValue - fee;

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

      await saveProvider({
        ...provider,
        activeServiceId: undefined,
        completedJobs: provider.completedJobs + 1,
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
              // Increment unread counter for the RECIPIENT
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

  const availableServices = services.filter((s) => s.status === "available");
  const activeService = provider.activeServiceId
    ? services.find((s) => s.id === provider.activeServiceId)
    : undefined;

  return {
    services,
    availableServices,
    activeService,
    provider,
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
    PLATFORM_FEE_RATE,
    URGENT_FEE,
  };
}

export const [AppContextProvider, useApp] = createContextHook(useAppContextValue);
