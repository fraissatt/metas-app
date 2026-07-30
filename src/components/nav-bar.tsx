import Link from 'next/link'

const links = [
  { href: '/', label: 'Hoje' },
  { href: '/week', label: 'Semana' },
  { href: '/objectives', label: 'Objetivos' },
]

export function NavBar() {
  return (
    <nav className="border-b">
      <div className="mx-auto flex max-w-2xl items-center gap-6 p-4">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm font-medium hover:underline">
            {link.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
