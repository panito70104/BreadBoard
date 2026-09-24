import { cn } from "@/lib/utils";

/** The one card surface every panel in the app shares. */
const CARD_CLASSES =
  "rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card)]";

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** Render as a different element when the semantics call for it. */
  as?: "div" | "article" | "section" | "li";
}

export function Card({ as: Tag = "div", className, ...props }: CardProps) {
  return <Tag className={cn(CARD_CLASSES, className)} {...props} />;
}

export function CardHeader({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return <div className={cn("space-y-1 p-5 sm:p-6", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"h3">) {
  return (
    <h3 className={cn("text-base font-semibold text-slate-900", className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-sm text-slate-500", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return <div className={cn("p-5 pt-0 sm:p-6 sm:pt-0", className)} {...props} />;
}
