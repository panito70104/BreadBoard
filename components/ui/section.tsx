import { cn } from "@/lib/utils";

export function Container({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}

export function Section({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"section">) {
  return <section className={cn("py-20 sm:py-24", className)} {...props} />;
}

export function Eyebrow({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold tracking-wide text-brand-700 uppercase",
        className,
      )}
      {...props}
    />
  );
}

export interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance text-slate-900 sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="max-w-2xl text-base text-pretty text-slate-600 sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}
