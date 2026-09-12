import { createFileRoute } from '@tanstack/react-router'

import { NotFoundScreen } from '@/components/not-found-screen'

// Sonda permanente (#230): nenhuma rota do app tem loader nem
// useSuspenseQuery, então não existe outro jeito de fazer um render estourar
// no browser para dar evidência visual e guarda de regressão à
// RouteErrorScreen. Em produção ela não existe como funcionalidade — devolve
// a mesma tela que qualquer URL inexistente devolveria.
export const Route = createFileRoute('/dev/error-probe')({ component: ErrorProbe })

function ErrorProbe() {
  // Renderizar <NotFoundScreen /> em vez de `throw notFound()` é deliberado: o
  // resultado visível é idêntico e não depende de o router capturar um
  // notFound() lançado de dentro do render.
  if (!import.meta.env.DEV) return <NotFoundScreen />
  throw new Error('sonda de erro de render (#230)')
}
