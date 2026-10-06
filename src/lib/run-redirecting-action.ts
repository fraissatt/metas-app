import { isRedirectError } from 'next/dist/client/components/redirect-error'

// A Server Action that calls redirect() rejects the awaited promise with a
// redirect error while the router navigates. Callers that fire and forget
// must ignore it, and rethrow anything else.
export async function runRedirectingAction(action: () => Promise<void>): Promise<void> {
  try {
    await action()
  } catch (error) {
    if (isRedirectError(error)) return
    throw error
  }
}
