import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { SmoothCaretInput } from "@/components/ui/smooth-caret-input"
import { cn } from "@/lib/utils"

const inputClassName =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"

// Only free-text fields get the gliding caret; dates, numbers, files and the
// like keep the native control, which has no text caret to animate.
const SMOOTH_CARET_TYPES = new Set([undefined, "text", "search", "password", "email", "url", "tel"])

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  if (SMOOTH_CARET_TYPES.has(type)) {
    return (
      <SmoothCaretInput type={type} data-slot="input" className={cn(inputClassName, className)} {...props} />
    )
  }

  return (
    <InputPrimitive type={type} data-slot="input" className={cn(inputClassName, className)} {...props} />
  )
}

export { Input }
