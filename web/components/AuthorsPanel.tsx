'use client'

import { Github } from 'lucide-react'

const AUTHORS = [
  {
    login: 'tfn-pt',
    name: 'tfn-pt',
    url: 'https://github.com/tfn-pt',
    role: 'Dados & Visualizacao',
    bio: '',
  },
  {
    login: 'simaonambi',
    name: 'simaonambi',
    url: 'https://github.com/simaonambi',
    role: 'Desenvolvimento',
    bio: '',
  },
] as const

export default function AuthorsPanel() {
  return (
    <div className="flex min-h-full items-center justify-center">
      <div className="w-full max-w-5xl rounded-lg border border-white/10 bg-[rgba(18,21,27,0.88)] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="mb-8 text-center">
          <div className="text-sm text-white/46">Autores</div>
          <h2 className="mt-1 font-serif text-3xl text-white">Quem construiu esta leitura visual</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {AUTHORS.map((author) => (
            <article key={author.login} className="rounded-lg border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <img
                  src={`https://github.com/${author.login}.png`}
                  alt={`Avatar de ${author.name}`}
                  className="h-16 w-16 rounded-full object-cover"
                />
                <div>
                  <div className="font-serif text-2xl text-white">{author.name}</div>
                  <div className="mt-1 text-sm text-white/46">{author.role}</div>
                </div>
              </div>

              <p className="mt-5 text-base leading-7 text-white/68">{author.bio}</p>

              <a
                href={author.url}
                target="_blank"
                rel="noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/58 transition-all duration-300 hover:scale-105 hover:border-[#14B8A6]/40 hover:text-white"
              >
                <Github className="h-4 w-4" />
                Ver perfil
              </a>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
