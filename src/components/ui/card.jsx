import { cn } from '../../lib/utils'

export function Card({ className, ...props }) {
  return <section className={cn('rounded-xl border border-border bg-white shadow-card', className)} {...props} />
}
