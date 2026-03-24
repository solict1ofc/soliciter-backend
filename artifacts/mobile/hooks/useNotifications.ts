import { useEffect, useRef } from "react";
import { useNotify } from "@/context/NotificationContext";
import type { Service, ServiceStatus } from "@/context/AppContext";

type NotifConfig = { title: string; body: string; type: "success" | "info" | "warning" | "error" };

const STATUS_NOTIFS: Partial<Record<ServiceStatus, NotifConfig>> = {
  available:   { title: "✅ Serviço Publicado!", body: "Sua solicitação está no Mercado Global.", type: "success" },
  accepted:    { title: "🤝 Prestador Aceitou!",  body: "Um prestador aceitou seu serviço.", type: "success" },
  in_progress: { title: "🔨 Serviço Iniciado",    body: "O prestador começou a executar.", type: "info" },
  completed:   { title: "🎉 Serviço Finalizado!", body: "Confirme o pagamento na aba Solicitar.", type: "warning" },
  rated:       { title: "💰 Pagamento Liberado",  body: "O prestador recebeu o pagamento.", type: "success" },
};

export function useServiceNotifications(services: Service[]) {
  const { notify } = useNotify();
  const prevMap = useRef<Record<string, ServiceStatus>>({});

  useEffect(() => {
    services.forEach((svc) => {
      const prev = prevMap.current[svc.id];
      if (prev && prev !== svc.status) {
        const cfg = STATUS_NOTIFS[svc.status];
        if (cfg) notify(cfg.title, cfg.body, cfg.type);
      }
      prevMap.current[svc.id] = svc.status;
    });
  }, [services]);
}
