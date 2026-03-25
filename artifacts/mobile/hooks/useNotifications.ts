import { useEffect, useRef } from "react";
import { useNotify, type NotifData } from "@/context/NotificationContext";
import type { Service, ServiceStatus } from "@/context/AppContext";

// ─── Status → notification config map ─────────────────────────────────────────

type StatusNotifConfig = {
  title: string;
  body: string;
  type: "success" | "info" | "warning" | "error";
  urgent?: boolean;
  getRoute: (serviceId: string) => NotifData;
};

const STATUS_NOTIFS: Partial<Record<ServiceStatus, StatusNotifConfig>> = {
  accepted: {
    title: "🤝 Prestador Aceitou!",
    body: "Um prestador aceitou. O chat foi liberado!",
    type: "success",
    getRoute: (id) => ({ type: "servico_aceito", serviceId: id }),
  },
  in_progress: {
    title: "🔨 Serviço Iniciado",
    body: "O prestador começou a executar.",
    type: "info",
    getRoute: (id) => ({ type: "servico_iniciado", serviceId: id }),
  },
  completed: {
    title: "💳 Serviço Concluído!",
    body: "Prestador finalizou. Efetue o pagamento na aba Solicitar!",
    type: "warning",
    urgent: true,
    getRoute: (id) => ({ type: "servico_concluido", serviceId: id }),
  },
  rated: {
    title: "✅ Pagamento Confirmado!",
    body: "O valor foi liberado para o prestador.",
    type: "success",
    getRoute: (id) => ({ type: "pagamento", serviceId: id }),
  },
};

// ─── Watch own services (status + chat changes) ────────────────────────────────

export function useServiceNotifications(services: Service[]) {
  const { notify, scheduleLocalNotification } = useNotify();
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

      // ── Status change ──────────────────────────────────────────────────────
      if (prevStatus && prevStatus !== svc.status) {
        const cfg = STATUS_NOTIFS[svc.status];
        if (cfg) {
          const data = cfg.getRoute(svc.id);
          notify(cfg.title, cfg.body, cfg.type, cfg.urgent ?? false, data);
          // Also schedule OS notification so it arrives even in background
          scheduleLocalNotification(cfg.title, cfg.body, data);
        }
      }

      // ── New message from provider (client perspective) ─────────────────────
      if (prevStatus !== undefined && currentUnreadClient > prevUnreadClient) {
        const last = svc.chatMessages?.at(-1);
        const preview = last?.text
          ? last.text.length > 40 ? last.text.slice(0, 40) + "…" : last.text
          : "Nova mensagem";
        const data: NotifData = { type: "mensagem_prestador", serviceId: svc.id };
        notify("💬 Prestador enviou uma mensagem", preview, "info", false, data);
        scheduleLocalNotification("💬 Prestador enviou uma mensagem", preview, data);
      }

      // ── New message from client (provider perspective) ─────────────────────
      if (prevStatus !== undefined && currentUnreadProvider > prevUnreadProvider) {
        const last = svc.chatMessages?.at(-1);
        const preview = last?.text
          ? last.text.length > 40 ? last.text.slice(0, 40) + "…" : last.text
          : "Nova mensagem";
        const data: NotifData = { type: "mensagem_cliente", serviceId: svc.id };
        notify("💬 Cliente enviou uma mensagem", preview, "info", false, data);
        scheduleLocalNotification("💬 Cliente enviou uma mensagem", preview, data);
      }

      prevStatusMap.current[svc.id] = svc.status;
      prevUnreadClientMap.current[svc.id] = currentUnreadClient;
      prevUnreadProviderMap.current[svc.id] = currentUnreadProvider;
    });
  }, [services]);
}

// ─── Watch marketplace — notify providers when NEW services arrive ──────────────

export function useMarketplaceNotifications(availableServices: Service[]) {
  const { notify, scheduleLocalNotification } = useNotify();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const currentIds = new Set(availableServices.map((s) => s.id));

    if (isFirstLoad.current) {
      seenIdsRef.current = currentIds;
      isFirstLoad.current = false;
      return;
    }

    const newServices = availableServices.filter((s) => !seenIdsRef.current.has(s.id));

    newServices.forEach((svc) => {
      const data: NotifData = { type: "nova_solicitacao", serviceId: svc.id };

      if (svc.urgent) {
        const title = "🚨 Solicitação URGENTE";
        const body = `"${svc.title}" — R$ ${svc.finalValue.toFixed(2)} em ${svc.city}`;
        notify(title, body, "error", true, data);
        scheduleLocalNotification(title, body, data);
      } else {
        const title = "Nova solicitação disponível";
        const body = `"${svc.title}" — R$ ${svc.finalValue.toFixed(2)} em ${svc.city}`;
        notify(title, body, "info", false, data);
        scheduleLocalNotification(title, body, data);
      }
    });

    seenIdsRef.current = currentIds;
  }, [availableServices]);
}
