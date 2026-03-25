import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBRL(cents: number | null | undefined) {
  if (cents == null) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function formatDate(dateString: string | Date | null | undefined) {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch (error) {
    return "-";
  }
}
