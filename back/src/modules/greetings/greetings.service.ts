import type { CreateGreetingBody, Greeting } from './greetings.schema'

// A module-local store stands in for a database — swap it for a real one behind
// the same two functions. Register the db handle as a singleton in context.ts
// (ADR-0004) and read it via c.get('db') when you do.
const greetings = new Map<string, Greeting>()

export function createGreeting(input: CreateGreetingBody): Greeting {
  const id = crypto.randomUUID()
  const greeting: Greeting = { id, message: 'Hello, ' + input.name + '!' }
  greetings.set(id, greeting)
  return greeting
}

export function getGreeting(id: string): Greeting | null {
  return greetings.get(id) ?? null
}
