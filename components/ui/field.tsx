import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"label">) {
  return (
    <label
      className={cn("block text-sm font-medium text-slate-700", className)}
      {...props}
    />
  );
}

const CONTROL_CLASSES =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand-400 focus:outline-2 focus:outline-offset-0 focus:outline-brand-200 disabled:cursor-not-allowed disabled:bg-slate-50";

export function Input({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"input">) {
  return <input className={cn(CONTROL_CLASSES, "h-11", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"textarea">) {
  return (
    <textarea className={cn(CONTROL_CLASSES, "min-h-24 resize-y", className)} {...props} />
  );
}

export function FieldHint({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-xs text-slate-500", className)} {...props} />;
}

export function FieldError({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"p">) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className={cn("text-sm font-medium text-red-600", className)}
      {...props}
    >
      {children}
    </p>
  );
}
