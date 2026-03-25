import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePayouts, usePayoutsSummary, useMarkPayoutPaid, type Payout } from "@/hooks/use-payouts";
import { formatBRL, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LogOut, Wallet, ArrowUpRight, CheckCircle2, Clock,
  RefreshCcw, User, Hash, ChevronUp, ChevronDown,
  ChevronsUpDown, X, AlertCircle, Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────
type TabFilter = "all" | "pending" | "paid";
type SortKey = "providerName" | "serviceId" | "totalAmount" | "platformFee" | "providerAmount" | "status" | "createdAt";
type SortDir = "asc" | "desc";
type ViewMode = "list" | "summary";

// ── Helpers ───────────────────────────────────────────────────────────────────
function SortIcon({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="inline w-3 h-3 ml-1 opacity-30" />;
  return dir === "asc"
    ? <ChevronUp className="inline w-3 h-3 ml-1 text-[#00D4FF]" />
    : <ChevronDown className="inline w-3 h-3 ml-1 text-[#00D4FF]" />;
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({ payout, onClose, onMarkPaid, isMarkingPaid }: {
  payout: Payout | null;
  onClose: () => void;
  onMarkPaid: (id: number) => void;
  isMarkingPaid: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!payout) return null;

  const handleConfirm = () => {
    onMarkPaid(payout.id);
    setConfirming(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: "spring", damping: 25 }}
        className="relative w-full max-w-lg bg-[#0F1117] border border-[#1E2235] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#161A25] border border-[#1E2235] flex items-center justify-center">
              <User className="w-5 h-5 text-[#00D4FF]" />
            </div>
            <div>
              <div className="font-semibold text-white">{payout.providerName || "Prestador Desconhecido"}</div>
              <div className="text-xs text-gray-400">{payout.providerEmail || payout.providerId}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fields */}
        <div className="space-y-3 mb-6">
          <Row label="ID do Serviço" value={<span className="font-mono text-xs">{payout.serviceId}</span>} />
          <Row label="ID do Pagamento MP" value={<span className="font-mono text-xs">{payout.paymentId || "—"}</span>} />
          <Row label="Valor Total (cliente pagou)" value={<span className="text-white font-bold">{formatBRL(payout.totalAmount)}</span>} />
          <Row label="Comissão da Plataforma (10%)" value={<span className="text-[#00D4FF] font-semibold">{formatBRL(payout.platformFee)}</span>} />
          <Row label="Valor a Pagar ao Prestador (90%)" value={<span className="text-[#00E676] font-bold text-lg">{formatBRL(payout.providerAmount)}</span>} />
          <Row label="Status" value={
            <Badge variant={payout.status === "pending" ? "warning" : "success"}>
              {payout.status === "pending" ? "Pendente" : "Pago"}
            </Badge>
          } />
          <Row label="Data do Serviço" value={formatDate(payout.createdAt)} />
          {payout.paidAt && <Row label="Pago em" value={formatDate(payout.paidAt)} />}
        </div>

        {/* Action */}
        {payout.status === "pending" && (
          !confirming ? (
            <Button
              className="w-full"
              variant="success"
              onClick={() => setConfirming(true)}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Marcar como Pago
            </Button>
          ) : (
            <div className="p-4 rounded-xl border border-[#FFB800]/30 bg-[#FFB800]/10 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-[#FFB800] mt-0.5 shrink-0" />
                <p className="text-sm text-[#FFB800]">
                  Confirmar que <strong>{formatBRL(payout.providerAmount)}</strong> foi transferido para <strong>{payout.providerName || payout.providerId}</strong>?
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setConfirming(false)} disabled={isMarkingPaid}>
                  Cancelar
                </Button>
                <Button variant="success" size="sm" className="flex-1" onClick={handleConfirm} disabled={isMarkingPaid}>
                  {isMarkingPaid ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar Pagamento"}
                </Button>
              </div>
            </div>
          )
        )}
        {payout.status === "paid" && (
          <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20">
            <CheckCircle2 className="w-4 h-4 text-[#00E676]" />
            <span className="text-sm text-[#00E676] font-medium">Pago em {formatDate(payout.paidAt)}</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#1E2235]/60">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-sm text-gray-200 text-right ml-4">{value}</span>
    </div>
  );
}

// ── Inline confirm button ─────────────────────────────────────────────────────
function MarkPaidButton({ payout, onMarkPaid, isMarkingPaid }: {
  payout: Payout;
  onMarkPaid: (id: number) => void;
  isMarkingPaid: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded-lg border border-[#1E2235] transition-colors"
        >
          Não
        </button>
        <button
          onClick={() => { onMarkPaid(payout.id); setConfirming(false); }}
          disabled={isMarkingPaid}
          className="text-xs text-black font-semibold bg-[#00E676] hover:bg-[#00E676]/90 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {isMarkingPaid ? <Loader2 className="w-3 h-3 animate-spin" /> : "Sim"}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
      className="text-xs font-semibold text-black bg-[#00E676] hover:bg-[#00E676]/90 px-3 py-1.5 rounded-lg transition-all hover:shadow-[0_0_10px_rgba(0,230,118,0.3)] active:scale-95"
    >
      Pagar
    </button>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export function Dashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);

  const { data: payouts = [], isLoading, refetch } = usePayouts(activeTab);
  const { data: summary = [], isLoading: isLoadingSummary } = usePayoutsSummary();
  const markPaid = useMarkPayoutPaid();

  // Stats from summary
  const totalPending = summary.reduce((s, r) => s + (r.totalPending ?? 0), 0);
  const totalPaid    = summary.reduce((s, r) => s + (r.totalPaid ?? 0), 0);
  const countPending = summary.reduce((s, r) => s + (r.countPending ?? 0), 0);
  const countPaid    = summary.reduce((s, r) => s + (r.countPaid ?? 0), 0);

  // Sorting
  const sorted = useMemo(() => {
    return [...payouts].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      switch (sortKey) {
        case "providerName":   av = a.providerName ?? ""; bv = b.providerName ?? ""; break;
        case "serviceId":      av = a.serviceId;          bv = b.serviceId;          break;
        case "totalAmount":    av = a.totalAmount;        bv = b.totalAmount;        break;
        case "platformFee":    av = a.platformFee;        bv = b.platformFee;        break;
        case "providerAmount": av = a.providerAmount;     bv = b.providerAmount;     break;
        case "status":         av = a.status;             bv = b.status;             break;
        case "createdAt":      av = a.createdAt ?? "";    bv = b.createdAt ?? "";    break;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [payouts, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handleMarkPaid = (id: number) => {
    markPaid.mutate(id, {
      onSuccess: () => {
        refetch();
        // Update selected payout if open
        setSelectedPayout(prev => prev?.id === id ? { ...prev, status: "paid", paidAt: new Date().toISOString() } : prev);
      }
    });
  };

  const thClass = "p-4 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap";
  const tabClass = (active: boolean, color: string) =>
    `px-5 py-2 rounded-full text-sm font-medium transition-all border ${active ? `${color} border-current` : "text-gray-400 border-transparent hover:text-white"}`;

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-[#1E2235] bg-[#0A0A0F]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#00D4FF] flex items-center justify-center">
              <Wallet className="w-4 h-4 text-black" />
            </div>
            <h1 className="font-bold text-lg text-white">
              SOLICITE <span className="text-[#00D4FF]">Admin</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => refetch()} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-[#161A25]">
              <RefreshCcw className="w-4 h-4" /> Atualizar
            </button>
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-[#161A25]">
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Pendente", value: formatBRL(totalPending), sub: `${countPending} serviço(s)`, color: "#FFB800", icon: <Clock className="w-5 h-5" /> },
            { label: "Total Pago", value: formatBRL(totalPaid), sub: `${countPaid} serviço(s)`, color: "#00E676", icon: <CheckCircle2 className="w-5 h-5" /> },
            { label: "Comissão Plataforma", value: formatBRL(Math.round((totalPending + totalPaid) * 10 / 90)), sub: "10% retido", color: "#00D4FF", icon: <ArrowUpRight className="w-5 h-5" /> },
            { label: "Total Transações", value: String(countPending + countPaid), sub: "desde o início", color: "#6C63FF", icon: <Hash className="w-5 h-5" /> },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#0F1117] border border-[#1E2235] rounded-2xl p-5 hover:border-[#2A2F45] transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400 font-medium">{stat.label}</span>
                <span style={{ color: stat.color }}>{stat.icon}</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div className="flex gap-1 bg-[#0F1117] border border-[#1E2235] p-1 rounded-xl">
            {(["list", "summary"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === mode ? "bg-[#161A25] text-white shadow" : "text-gray-400 hover:text-white"}`}
              >
                {mode === "list" ? "Lista de Payouts" : "Por Prestador"}
              </button>
            ))}
          </div>

          {viewMode === "list" && (
            <div className="flex gap-2">
              <button onClick={() => setActiveTab("all")}     className={tabClass(activeTab === "all",     "text-white")}>Todos</button>
              <button onClick={() => setActiveTab("pending")} className={tabClass(activeTab === "pending", "text-[#FFB800]")}>Pendentes</button>
              <button onClick={() => setActiveTab("paid")}    className={tabClass(activeTab === "paid",    "text-[#00E676]")}>Pagos</button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-[#0F1117] border border-[#1E2235] rounded-2xl overflow-hidden">
          <AnimatePresence mode="wait">
            {viewMode === "list" ? (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-[#1E2235] bg-[#080B12]">
                        <th className={`${thClass} text-gray-400`} onClick={() => handleSort("providerName")}>
                          Prestador <SortIcon col="providerName" sortKey={sortKey} dir={sortDir} />
                        </th>
                        <th className={`${thClass} text-gray-400`} onClick={() => handleSort("serviceId")}>
                          Serviço <SortIcon col="serviceId" sortKey={sortKey} dir={sortDir} />
                        </th>
                        <th className={`${thClass} text-gray-400`} onClick={() => handleSort("totalAmount")}>
                          Valor Total <SortIcon col="totalAmount" sortKey={sortKey} dir={sortDir} />
                        </th>
                        <th className={`${thClass} text-[#00D4FF]`} onClick={() => handleSort("platformFee")}>
                          Comissão 10% <SortIcon col="platformFee" sortKey={sortKey} dir={sortDir} />
                        </th>
                        <th className={`${thClass} text-white`} onClick={() => handleSort("providerAmount")}>
                          A Pagar 90% <SortIcon col="providerAmount" sortKey={sortKey} dir={sortDir} />
                        </th>
                        <th className={`${thClass} text-gray-400`} onClick={() => handleSort("status")}>
                          Status <SortIcon col="status" sortKey={sortKey} dir={sortDir} />
                        </th>
                        <th className={`${thClass} text-gray-400`} onClick={() => handleSort("createdAt")}>
                          Data <SortIcon col="createdAt" sortKey={sortKey} dir={sortDir} />
                        </th>
                        <th className="p-4 text-xs font-semibold uppercase tracking-wider text-gray-400 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="p-12 text-center text-gray-400">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                            <div>Carregando payouts...</div>
                          </td>
                        </tr>
                      ) : sorted.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-16 text-center text-gray-500">
                            <div className="text-4xl mb-3">💸</div>
                            <div className="text-base">Nenhum payout encontrado.</div>
                            <div className="text-sm mt-1">Quando serviços forem concluídos e pagos, aparecerão aqui.</div>
                          </td>
                        </tr>
                      ) : sorted.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedPayout(p)}
                          className="border-t border-[#1E2235] hover:bg-[#161A25] transition-colors cursor-pointer group"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-full bg-[#161A25] border border-[#1E2235] flex items-center justify-center text-gray-400 shrink-0">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="text-sm font-medium text-white">{p.providerName || "Desconhecido"}</div>
                                <div className="text-xs text-gray-500">{p.providerEmail || p.providerId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-xs font-mono text-gray-400 bg-[#161A25] px-2 py-0.5 rounded">
                              #{p.serviceId.replace("svc_", "").slice(-8)}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-gray-300">{formatBRL(p.totalAmount)}</td>
                          <td className="p-4 text-sm font-medium text-[#00D4FF]">{formatBRL(p.platformFee)}</td>
                          <td className="p-4 text-sm font-bold text-white">{formatBRL(p.providerAmount)}</td>
                          <td className="p-4">
                            <Badge variant={p.status === "pending" ? "warning" : "success"}>
                              {p.status === "pending" ? "Pendente" : "Pago"}
                            </Badge>
                          </td>
                          <td className="p-4 text-xs text-gray-400">{formatDate(p.createdAt)}</td>
                          <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                            {p.status === "pending" ? (
                              <MarkPaidButton
                                payout={p}
                                onMarkPaid={handleMarkPaid}
                                isMarkingPaid={markPaid.isPending}
                              />
                            ) : (
                              <span className="text-xs text-[#00E676] flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                {formatDate(p.paidAt)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            ) : (
              <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6">
                {isLoadingSummary ? (
                  <div className="p-12 text-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    <div>Carregando resumo...</div>
                  </div>
                ) : summary.length === 0 ? (
                  <div className="p-16 text-center text-gray-500">
                    <div className="text-4xl mb-3">📊</div>
                    <div>Nenhum dado de prestador encontrado.</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {summary.map((prov) => (
                      <Card key={prov.providerId} className="bg-[#161A25] border-[#1E2235] hover:border-[#00D4FF]/30 transition-colors">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#0F1117] border border-[#1E2235] flex items-center justify-center">
                              <User className="w-5 h-5 text-[#00D4FF]" />
                            </div>
                            <div>
                              <CardTitle className="text-base text-white">{prov.providerName || "Prestador Desconhecido"}</CardTitle>
                              <p className="text-xs text-gray-400">{prov.providerEmail || prov.providerId}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between items-center p-3 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/20">
                            <div>
                              <p className="text-xs text-[#FFB800] mb-0.5">Pendente</p>
                              <p className="text-xl font-bold text-white">{formatBRL(prov.totalPending)}</p>
                            </div>
                            <span className="text-xs text-[#FFB800] font-medium">{prov.countPending} serv.</span>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-xl bg-[#00E676]/10 border border-[#00E676]/20">
                            <div>
                              <p className="text-xs text-[#00E676] mb-0.5">Pago</p>
                              <p className="text-lg font-semibold text-gray-300">{formatBRL(prov.totalPaid)}</p>
                            </div>
                            <span className="text-xs text-gray-400">{prov.countPaid} serv.</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedPayout && (
          <DetailDrawer
            payout={selectedPayout}
            onClose={() => setSelectedPayout(null)}
            onMarkPaid={handleMarkPaid}
            isMarkingPaid={markPaid.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
