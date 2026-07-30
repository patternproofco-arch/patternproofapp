import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/attorneys')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/attorneys"!</div>
}
