interface SectionEyebrowProps {
  children: React.ReactNode
}

export function SectionEyebrow({ children }: SectionEyebrowProps) {
  return (
    <p className='mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
      {children}
    </p>
  )
}
