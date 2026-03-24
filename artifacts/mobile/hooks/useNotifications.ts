import { useEffect, useRef } from "react";
import { useNotify } from "@/context/NotificationContext";
import type { Service, ServiceStatus } from "@/context/AppContext";

type NotifConfig = { title: string; body: string; type: "success" | "info" | "warning" | "error" };

const STATUS_NOTIFS: Partial<Record<ServiceStatus, NotifConfig>> = {
  available:   { title: "✅ Serviço Publicado!", body: "Sua solicitação está no Mercado Global.", type: "success" },
  accepted:    { title: "🤝 Prestador Aceitou!",  body: "Um prestador aceitou. O chat foi liberado!", type: "success" },
  in_progress: { title: "🔨 Serviço Iniciado",    body: "O prestador começou a executar.", type: "info" },
  completed:   { title: "💳 Serviço Concluído!", body: "Prestador finalizou. Efetue o pagamento na aba Solicitar!", type: "warning" },
  rated:       { title: "✅ Pagamento Confirmado!", body: "O valor foi liberado direto para o prestador.", type: "success" },
};

export function useServiceNotifications(services: Service[]) {
  const { notify } = useNotify();
  const prevStatusMap = useRef<Record<string, ServiceStatus>>({});
  const prevMsgCountMap = useRef<Record<string, number>>({});
  const prevUnreadClientMap = useRef<Record<string, number>>({});
  const prevUnreadProviderMap = useRef<Record<string, number>>({});

  useEffect(() => {
    services.forEach((svc) => {
      const prevStatus = prevStatusMap.current[svc.id];
      const prevMsgCount = prevMsgCountMap.current[svc.id] ?? 0;
      const prevUnreadClient = prevUnreadClientMap.current[svc.id] ?? 0;
      const prevUnreadProvider = prevUnreadProviderMap.current[svc.id] ?? 0;

      const currentMsgCount = svc.chatMessages?.length ?? 0;
      const currentUnreadClient = svc.unreadClient ?? 0;
      const currentUnreadProvider = svc.unreadProvider ?? 0;

      // ── Status change notifications ─────────────────────────────────────────
      if (prevStatus && prevStatus !== svc.status) {
        const cfg = STATUS_NOTIFS[svc.status];
        if (cfg) notify(cfg.title, cfg.body, cfg.type);
      }

      // ── New message from provider (client perspective) ──────────────────────
      if (
        prevStatus !== undefined && // not first load
        currentUnreadClient > prevUnreadClient
      ) {
        const last = svc.chatMessages?.at(-1);
        const preview = last?.text ? (last.text.length > 40 ? last.text.slice(0, 40) + "…" : last.text) : "Nova mensagem";
        notify("💬 Prestador enviou uma mensagem", preview, "info");
      }

      // ── New message from client (provider perspective) ──────────────────────
      if (
        prevStatus !== undefined && // not first load
        currentUnreadProvider > prevUnreadProvider
      ) {
        const last = svc.chatMessages?.at(-1);
        const preview = last?.text ? (last.text.length > 40 ? last.text.slice(0, 40) + "…" : last.text) : "Nova mensagem";
        notify("💬 Cliente enviou uma mensagem", preview, "info");
      }

      // Update refs
      prevStatusMap.current[svc.id] = svc.status;
      prevMsgCountMap.current[svc.id] = currentMsgCount;
      prevUnreadClientMap.current[svc.id] = currentUnreadClient;
      prevUnreadProviderMap.current[svc.id] = currentUnreadProvider;
    });
  }, [services]);
}
