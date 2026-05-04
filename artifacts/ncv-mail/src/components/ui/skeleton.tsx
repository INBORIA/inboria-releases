import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-md bg-white/[0.03]", className)}
      {...props}
    />
  )
}

export { Skeleton }
