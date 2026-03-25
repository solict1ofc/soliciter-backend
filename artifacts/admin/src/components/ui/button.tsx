import * as React from "react"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "danger" | "success" | "accent";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, disabled, ...props }, ref) => {
    
    const variants = {
      default: "bg-[hsl(var(--color-primary))] text-[hsl(var(--color-primary-foreground))] hover:bg-[hsl(var(--color-primary))/0.9] shadow-[0_0_15px_hsl(var(--color-primary)/0.2)]",
      outline: "border border-[hsl(var(--color-border))] bg-transparent hover:bg-[hsl(var(--color-secondary))] text-[hsl(var(--color-foreground))]",
      ghost: "bg-transparent hover:bg-[hsl(var(--color-secondary))] text-[hsl(var(--color-foreground))]",
      danger: "bg-[hsl(var(--color-destructive))] text-[hsl(var(--color-destructive-foreground))] hover:bg-[hsl(var(--color-destructive))/0.9]",
      success: "bg-[hsl(var(--color-success))] text-[hsl(var(--color-success-foreground))] hover:bg-[hsl(var(--color-success))/0.9]",
      accent: "bg-[hsl(var(--color-accent))] text-[hsl(var(--color-accent-foreground))] hover:bg-[hsl(var(--color-accent))/0.9] shadow-[0_0_15px_hsl(var(--color-accent)/0.2)]",
    }
    
    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-9 rounded-lg px-3",
      lg: "h-12 rounded-xl px-8",
      icon: "h-10 w-10",
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-ring))] disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
