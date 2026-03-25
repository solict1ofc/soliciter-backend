import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, ShieldAlert, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export function Login() {
  const [tokenInput, setTokenInput] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) {
      setError("Por favor, insira o token admin.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Test the token
      const res = await fetch("/api/admin/payouts", {
        headers: { Authorization: `Bearer ${tokenInput}` }
      });
      
      if (res.status === 401) {
        throw new Error("Token inválido.");
      }
      if (!res.ok) {
        throw new Error("Erro de conexão com o servidor.");
      }
      
      // Success
      login(tokenInput);
      setLocation("/");
    } catch (err: any) {
      setError(err.message || "Falha na autenticação");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden bg-[hsl(var(--color-background))]">
      {/* Background Image / Effects */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none">
        <img 
          src={`${import.meta.env.BASE_URL}images/auth-bg.png`} 
          alt="Tech background" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--color-background))] to-transparent"></div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[hsl(var(--color-primary))/0.05] rounded-full blur-[120px] z-0 pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="z-10 w-full max-w-md px-6"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[hsl(var(--color-card))] border border-[hsl(var(--color-border))] mb-6 shadow-2xl shadow-[hsl(var(--color-primary))/0.2]">
            <Lock className="w-8 h-8 text-[hsl(var(--color-primary))]" />
          </div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">SOLICITE Admin</h1>
          <p className="text-[hsl(var(--color-muted-foreground))]">Gestão de Pagamentos da Plataforma</p>
        </div>

        <Card className="glass-panel border-[hsl(var(--color-border))/50]">
          <CardHeader>
            <CardTitle className="text-xl">Acesso Restrito</CardTitle>
            <CardDescription>Insira sua chave de segurança para acessar o painel financeiro.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="ADMIN_SECRET"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="font-mono text-center tracking-widest text-lg h-14 bg-black/40"
                />
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-3 rounded-lg bg-[hsl(var(--color-destructive))/0.1] border border-[hsl(var(--color-destructive))/0.2] flex items-center text-[hsl(var(--color-destructive))] text-sm"
                >
                  <ShieldAlert className="w-4 h-4 mr-2 flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button 
                type="submit" 
                className="w-full h-14 text-lg font-bold" 
                isLoading={isLoading}
              >
                {!isLoading && (
                  <>
                    Autenticar <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <p className="text-center text-xs text-[hsl(var(--color-muted-foreground))] mt-8">
          Acesso monitorado. Todas as ações são registradas.
        </p>
      </motion.div>
    </div>
  );
}
