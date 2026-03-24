import AsyncStorage from "@react-native-async-storage/async-storage";
import createContextHook from "@nkzw/create-context-hook";
import React, { useCallback, useEffect, useState } from "react";

export type Urgency = boolean;

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
  completedAt?: string;
  providerId?: string;
  clientRating?: number;
  providerRating?: number;
  chatMessages?: ChatMessage[];
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

const SERVICES_KEY = "servicosapp_services";
const PROVIDER_KEY = "servicosapp_provider";

const URGENT_FEE = 10;
const PLATFORM_FEE_RATE = 0.1;

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
      console.error("Error loading data", e);
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
      const updated = [...services, newService];
      await saveServices(updated);
      return newService;
    },
    [services, saveServices]
  );

  const confirmPayment = useCallback(
    async (serviceId: string) => {
      const updated = services.map((s) =>
        s.id === serviceId ? { ...s, status: "available" as ServiceStatus } : s
      );
      await saveServices(updated);
    },
    [services, saveServices]
  );

  const acceptService = useCallback(
    async (serviceId: string) => {
      if (provider.activeServiceId) return false;
      const updated = services.map((s) =>
        s.id === serviceId
          ? {
              ...s,
              status: "in_progress" as ServiceStatus,
              acceptedAt: new Date().toISOString(),
              providerId: provider.id,
            }
          : s
      );
      await saveServices(updated);
      const updatedProvider = { ...provider, activeServiceId: serviceId };
      await saveProvider(updatedProvider);
      return true;
    },
    [services, provider, saveServices, saveProvider]
  );

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

  const confirmClientPayment = useCallback(
    async (serviceId: string) => {
      const service = services.find((s) => s.id === serviceId);
      if (!service) return;

      const fee = service.finalValue * PLATFORM_FEE_RATE;
      const providerEarning = service.finalValue - fee;

      const updated = services.map((s) =>
        s.id === serviceId ? { ...s, status: "rated" as ServiceStatus } : s
      );
      await saveServices(updated);

      const updatedProvider = {
        ...provider,
        activeServiceId: undefined,
        completedJobs: provider.completedJobs + 1,
        earnings: provider.earnings + providerEarning,
      };
      await saveProvider(updatedProvider);

      return { fee, providerEarning };
    },
    [services, provider, saveServices, saveProvider]
  );

  const rateService = useCallback(
    async (serviceId: string, rating: number, raterType: "client" | "provider") => {
      const updated = services.map((s) =>
        s.id === serviceId
          ? raterType === "client"
            ? { ...s, clientRating: rating }
            : { ...s, providerRating: rating }
          : s
      );
      await saveServices(updated);

      if (raterType === "client") {
        const totalRatings = provider.totalRatings + 1;
        const newRating =
          (provider.rating * provider.totalRatings + rating) / totalRatings;
        const updatedProvider = {
          ...provider,
          rating: Math.round(newRating * 10) / 10,
          totalRatings,
        };
        await saveProvider(updatedProvider);
      }
    },
    [services, provider, saveServices, saveProvider]
  );

  const subscribePlan = useCallback(
    async (plan: ProviderPlan) => {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      const updatedProvider = {
        ...provider,
        plan,
        planExpiresAt: expiresAt.toISOString(),
      };
      await saveProvider(updatedProvider);
    },
    [provider, saveProvider]
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
          ? { ...s, chatMessages: [...(s.chatMessages ?? []), msg] }
          : s
      );
      await saveServices(updated);
    },
    [services, saveServices]
  );

  const availableServices = services.filter((s) => s.status === "available");
  const activeService = services.find(
    (s) => s.id === provider.activeServiceId
  );

  return {
    services,
    availableServices,
    activeService,
    provider,
    loading,
    createService,
    confirmPayment,
    acceptService,
    finalizeService,
    confirmClientPayment,
    rateService,
    subscribePlan,
    sendMessage,
    PLATFORM_FEE_RATE,
    URGENT_FEE,
  };
}

export const [AppContextProvider, useApp] = createContextHook(useAppContextValue);
