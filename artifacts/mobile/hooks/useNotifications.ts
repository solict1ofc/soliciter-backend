import { useEffect, useRef } from "react";
import * as Haptics from "expo-haptics";
import { useNotify } from "@/context/NotificationContext";
import type { Service, ServiceStatus } from "@/context/AppContext";

type NotifConfig = {
  title: string;
  body: string;
  type: "success" | "info" | "warning" | "error";
  urgent?: boolean;
};

const STATUS_NOTIFS: Partial<Record<ServiceStatus, NotifConfig>> = {
  accepted:    { title: "🤝 Prestador Aceitou!",  body: "Um prestador aceitou. O chat foi liberado!", type: "success" },
  in_progress: { title: "🔨 Serviço Iniciado",    body: "O prestador começou a executar.", type: "info" },
  completed:   { title: "💳 Serviço Concluído!", body: "Prestador finalizou. Efetue o pagamento na aba Solicitar!", type: "warning" },
  rated:       { title: "✅ Pagamento Confirmado!", body: "O valor foi liberado para o prestador.", type: "success" },
};

// ── Watch own services (status + chat changes) ─────────────────────────────────
export function useServiceNotifications(services: Service[]) {
  const { notify } = useNotify();
  const prevStatusMap = useRef<Record<string, ServiceStatus>>({});
  const prevUnreadClientMap = useRef<Record<string, number>>({});
  const prevUnreadProviderMap = useRef<Record<string, number>>({});

  useEffect(() => {
    services.forEach((svc) => {
      const prevStatus = prevStatusMap.current[svc.id];
      const prevUnreadClient = prevUnreadClientMap.current[svc.id] ?? 0;
      const prevUnreadProvider = prevUnreadProviderMap.current[svc.id] ?? 0;
      const currentUnreadClient = svc.unreadClient ?? 0;
      const currentUnreadProvider = svc.unreadProvider ?? 0;

      // ── Status change ─────────────────────────────────────────────────────
      if (prevStatus && prevStatus !== svc.status) {
        const cfg = STATUS_NOTIFS[svc.status];
        if (cfg) notify(cfg.title, cfg.body, cfg.type, cfg.urgent ?? false);
      }

      // ── New message from provider (client perspective) ────────────────────
      if (prevStatus !== undefined && currentUnreadClient > prevUnreadClient) {
        const last = svc.chatMessages?.at(-1);
        const preview = last?.text
          ? last.text.length > 40 ? last.text.slice(0, 40) + "…" : last.text
          : "Nova mensagem";
        notify("💬 Prestador enviou uma mensagem", preview, "info");
      }

      // ── New message from client (provider perspective) ────────────────────
      if (prevStatus !== undefined && currentUnreadProvider > prevUnreadProvider) {
        const last = svc.chatMessages?.at(-1);
        const preview = last?.text
          ? last.text.length > 40 ? last.text.slice(0, 40) + "…" : last.text
          : "Nova mensagem";
        notify("💬 Cliente enviou uma mensagem", preview, "info");
      }

      prevStatusMap.current[svc.id] = svc.status;
      prevUnreadClientMap.current[svc.id] = currentUnreadClient;
      prevUnreadProviderMap.current[svc.id] = currentUnreadProvider;
    });
  }, [services]);
}

// ── Watch marketplace — notify providers when NEW services arrive ───────────────
export function useMarketplaceNotifications(availableServices: Service[]) {
  const { notify } = useNotify();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const currentIds = new Set(availableServices.map((s) => s.id));

    if (isFirstLoad.current) {
      // Populate seen IDs on first load without triggering notifications
      seenIdsRef.current = currentIds;
      isFirstLoad.current = false;
      return;
    }

    const newServices = availableServices.filter(
      (s) => !seenIdsRef.current.has(s.id)
    );

    newServices.forEach((svc) => {
      if (svc.urgent) {
        notify(
          "🚨 Solicitação URGENTE",
          `"${svc.title}" — R$ ${svc.finalValue.toFixed(2)} em ${svc.city}`,
          "error",
          true
        );
      } else {
        notify(
          "Nova solicitação disponível",
          `"${svc.title}" — R$ ${svc.finalValue.toFixed(2)} em ${svc.city}`,
          "info",
          false
        );
      }
    });

    seenIdsRef.current = currentIds;
  }, [availableServices]);
}
