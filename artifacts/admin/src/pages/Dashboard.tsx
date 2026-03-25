import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePayouts, usePayoutsSummary, useMarkPayoutPaid, Payout } from "@/hooks/use-payouts";
import { formatBRL, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LogOut, 
  Wallet, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  Search,
  RefreshCcw,
  User,
  Hash
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function Dashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"pending" | "paid" | "all">("pending");
  const [viewMode, setViewMode] = useState<"list" | "summary">("list");
  
  const { data: payouts, isLoading: isLoadingPayouts, refetch: refetchPayouts } = usePayouts(activeTab);
  const { data: summary, isLoading: isLoadingSummary } = usePayoutsSummary();
  const markPaid = useMarkPayoutPaid();

  // Calculate totals from summary if available
  const totalPending = summary?.reduce((acc, curr) => acc + curr.totalPending, 0) || 0;
  const totalPaid = summary?.reduce((acc, curr) => acc + curr.totalPaid, 0) || 0;
  const countPending = summary?.reduce((acc, curr) => acc + curr.countPending, 0) || 0;
  const countPaid = summary?.reduce((acc, curr) => acc + curr.countPaid, 0) || 0;

  const handleMarkPaid = async (id: number) => {
    if (confirm("Confirmar que este valor foi transferido para o prestador?")) {
      await markPaid.mutateAsync(id);
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--color-background))] flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-[hsl(var(--color-border))] bg-[hsl(var(--color-background))/0.8] backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--color-primary))] flex items-center justify-center shadow-lg shadow-[hsl(var(--color-primary))/0.3]">
              <Wallet className="w-4 h-4 text-black" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight text-white hidden sm:block">
              SOLICITE <span className="text-[hsl(var(--color-primary))]">Admin</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => refetchPayouts()}>
              <RefreshCcw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
            <div className="w-px h-6 bg-[hsl(var(--color-border))]"></div>
            <Button variant="ghost" size="sm" onClick={logout} className="text-[hsl(var(--color-muted-foreground))] hover:text-white">
              <LogOut className="w-4 h-4 mr-2" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-br from-[hsl(var(--color-card))] to-[hsl(var(--color-card))/0.5] border-[hsl(var(--color-border))] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Clock className="w-16 h-16 text-[hsl(var(--color-warning))]" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--color-muted-foreground))]">Total Pendente a Pagar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-[hsl(var(--color-warning))] glow-warning">
                {formatBRL(totalPending)}
              </div>
              <p className="text-xs text-[hsl(var(--color-muted-foreground))] mt-1">{countPending} serviços aguardando</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[hsl(var(--color-card))] to-[hsl(var(--color-card))/0.5] border-[hsl(var(--color-border))] relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <CheckCircle2 className="w-16 h-16 text-[hsl(var(--color-success))]" />
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--color-muted-foreground))]">Total Já Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-display font-bold text-[hsl(var(--color-success))]">
                {formatBRL(totalPaid)}
              </div>
              <p className="text-xs text-[hsl(var(--color-muted-foreground))] mt-1">{countPaid} serviços pagos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[hsl(var(--color-card))] to-[hsl(var(--color-card))/0.5] border-[hsl(var(--color-border))] sm:col-span-2 lg:col-span-2 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--color-primary))/0.05] to-transparent pointer-events-none"></div>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-[hsl(var(--color-muted-foreground))]">Receita Bruta Plataforma (Estimada)</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-display font-bold text-white">
                  {formatBRL((totalPending + totalPaid) * (10/90))} {/* Approximate platform fee total */}
                </div>
                <p className="text-xs text-[hsl(var(--color-primary))] mt-1 flex items-center">
                  <ArrowUpRight className="w-3 h-3 mr-1" /> 10% de comissão retida
                </p>
              </div>
              <div className="h-10 w-24 bg-[hsl(var(--color-primary))/0.1] rounded-lg border border-[hsl(var(--color-primary))/0.2] flex items-center justify-center">
                <span className="text-[hsl(var(--color-primary))] font-mono text-sm">+{(countPaid + countPending)} tx</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="bg-[hsl(var(--color-secondary))] p-1 rounded-xl inline-flex">
            <button 
              onClick={() => setViewMode("list")}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "list" ? "bg-[hsl(var(--color-card))] text-white shadow" : "text-[hsl(var(--color-muted-foreground))] hover:text-white"}`}
            >
              Lista de Payouts
            </button>
            <button 
              onClick={() => setViewMode("summary")}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "summary" ? "bg-[hsl(var(--color-card))] text-white shadow" : "text-[hsl(var(--color-muted-foreground))] hover:text-white"}`}
            >
              Resumo por Prestador
            </button>
          </div>

          {viewMode === "list" && (
            <div className="flex gap-2">
              {(["pending", "paid", "all"] as const).map((tab) => (
                <Badge 
                  key={tab}
                  variant={activeTab === tab ? (tab === 'pending' ? 'warning' : tab === 'paid' ? 'success' : 'default') : 'outline'}
                  className={`cursor-pointer px-4 py-1.5 text-sm ${activeTab !== tab ? 'hover:bg-[hsl(var(--color-secondary))]' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'pending' ? 'Pendentes' : tab === 'paid' ? 'Pagos' : 'Todos'}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="bg-[hsl(var(--color-card))] border border-[hsl(var(--color-border))] rounded-2xl overflow-hidden shadow-xl">
          
          <AnimatePresence mode="wait">
            {viewMode === "list" ? (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="overflow-x-auto"
              >
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[hsl(var(--color-secondary))/0.5] border-b border-[hsl(var(--color-border))]">
                      <th className="p-4 text-xs font-semibold text-[hsl(var(--color-muted-foreground))] uppercase tracking-wider">Prestador</th>
                      <th className="p-4 text-xs font-semibold text-[hsl(var(--color-muted-foreground))] uppercase tracking-wider">Serviço</th>
                      <th className="p-4 text-xs font-semibold text-[hsl(var(--color-muted-foreground))] uppercase tracking-wider">Valor Total</th>
                      <th className="p-4 text-xs font-semibold text-[hsl(var(--color-primary))] uppercase tracking-wider">Comissão (10%)</th>
                      <th className="p-4 text-xs font-semibold text-white uppercase tracking-wider">A Pagar (90%)</th>
                      <th className="p-4 text-xs font-semibold text-[hsl(var(--color-muted-foreground))] uppercase tracking-wider">Status</th>
                      <th className="p-4 text-xs font-semibold text-[hsl(var(--color-muted-foreground))] uppercase tracking-wider">Data</th>
                      <th className="p-4 text-xs font-semibold text-[hsl(var(--color-muted-foreground))] uppercase tracking-wider text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--color-border))]">
                    {isLoadingPayouts ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-[hsl(var(--color-muted-foreground))]">Carregando payouts...</td>
                      </tr>
                    ) : payouts?.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-16 text-center">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[hsl(var(--color-secondary))] mb-4">
                            <Search className="w-8 h-8 text-[hsl(var(--color-muted-foreground))]" />
                          </div>
                          <p className="text-[hsl(var(--color-muted-foreground))] text-lg">Nenhum registro encontrado.</p>
                        </td>
                      </tr>
                    ) : (
                      payouts?.map((payout: Payout) => (
                        <tr key={payout.id} className="hover:bg-[hsl(var(--color-secondary))/0.3] transition-colors group">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-[hsl(var(--color-secondary))] flex items-center justify-center text-[hsl(var(--color-muted-foreground))]">
                                <User className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-medium text-sm text-white">{payout.providerName || 'Desconhecido'}</div>
                                <div className="text-xs text-[hsl(var(--color-muted-foreground))]">{payout.providerEmail || payout.providerId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center text-xs font-mono text-[hsl(var(--color-muted-foreground))]">
                              <Hash className="w-3 h-3 mr-1" />
                              {payout.serviceId.split('_')[1] || payout.serviceId.substring(0, 8)}
                            </div>
                          </td>
                          <td className="p-4 text-sm font-medium text-[hsl(var(--color-muted-foreground))]">
                            {formatBRL(payout.totalAmount)}
                          </td>
                          <td className="p-4 text-sm font-medium text-[hsl(var(--color-primary))]">
                            {formatBRL(payout.platformFee)}
                          </td>
                          <td className="p-4 text-sm font-bold text-white text-glow-primary">
                            {formatBRL(payout.providerAmount)}
                          </td>
                          <td className="p-4">
                            <Badge variant={payout.status === 'pending' ? 'warning' : 'success'}>
                              {payout.status === 'pending' ? 'Pendente' : 'Pago'}
                            </Badge>
                          </td>
                          <td className="p-4 text-xs text-[hsl(var(--color-muted-foreground))] whitespace-nowrap">
                            {formatDate(payout.createdAt)}
                          </td>
                          <td className="p-4 text-right">
                            {payout.status === 'pending' ? (
                              <Button 
                                size="sm" 
                                variant="accent"
                                onClick={() => handleMarkPaid(payout.id)}
                                disabled={markPaid.isPending}
                                className="h-8"
                              >
                                Pagar Agora
                              </Button>
                            ) : (
                              <span className="text-xs text-[hsl(var(--color-success))] font-medium flex items-center justify-end">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                {formatDate(payout.paidAt)}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </motion.div>
            ) : (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-6"
              >
                {isLoadingSummary ? (
                  <div className="p-8 text-center text-[hsl(var(--color-muted-foreground))]">Carregando resumo...</div>
                ) : summary?.length === 0 ? (
                  <div className="p-16 text-center text-[hsl(var(--color-muted-foreground))]">Nenhum dado de prestador encontrado.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {summary?.map((prov) => (
                      <Card key={prov.providerId} className="bg-[hsl(var(--color-secondary))/0.5] border-[hsl(var(--color-border))] hover:border-[hsl(var(--color-primary))/0.5] transition-colors">
                        <CardHeader className="pb-2 border-b border-[hsl(var(--color-border))] mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[hsl(var(--color-card))] border border-[hsl(var(--color-border))] flex items-center justify-center">
                              <User className="w-5 h-5 text-[hsl(var(--color-primary))]" />
                            </div>
                            <div>
                              <CardTitle className="text-base text-white">{prov.providerName || 'Prestador Desconhecido'}</CardTitle>
                              <p className="text-xs text-[hsl(var(--color-muted-foreground))]">{prov.providerEmail || prov.providerId}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex justify-between items-end bg-[hsl(var(--color-warning))/0.1] p-3 rounded-lg border border-[hsl(var(--color-warning))/0.2]">
                            <div>
                              <p className="text-xs text-[hsl(var(--color-warning))] font-medium mb-1">A Pagar</p>
                              <p className="text-xl font-display font-bold text-white">{formatBRL(prov.totalPending)}</p>
                            </div>
                            <Badge variant="warning" className="bg-transparent border-none px-0">{prov.countPending} un</Badge>
                          </div>
                          <div className="flex justify-between items-end bg-[hsl(var(--color-success))/0.1] p-3 rounded-lg border border-[hsl(var(--color-success))/0.2]">
                            <div>
                              <p className="text-xs text-[hsl(var(--color-success))] font-medium mb-1">Já Pago</p>
                              <p className="text-lg font-display font-semibold text-[hsl(var(--color-muted-foreground))]">{formatBRL(prov.totalPaid)}</p>
                            </div>
                            <span className="text-xs text-[hsl(var(--color-muted-foreground))]">{prov.countPaid} un</span>
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
    </div>
  );
}
