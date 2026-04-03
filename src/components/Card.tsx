import type { ReactNode }from 'react'

export default function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 mb-4">
      {title && <h2 className="text-sm font-semibold mb-2">{title}</h2>}
      {children}
    </div>
  )
}
