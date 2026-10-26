import { prisma } from '@/lib/db'

const SIGN_UP_PATH = '/sign-up/email'

type LinkArgs = {
  anonymousUser: { user: { id: string } }
  newUser: { user: { id: string; isAnonymous?: boolean | null } }
  ctx: { path?: string }
}

/**
 * Better Auth's anonymous plugin calls this after a sign-up or sign-in that
 * started from a guest session, and deletes the guest right afterwards. A new
 * account keeps what the guest built (objectives, with their goals and tasks,
 * and the weeks reviewed);
 * signing in to an existing account moves nothing, so that account is never
 * touched and the guest data is simply discarded.
 */
export async function moveGuestDataOnSignUp({ anonymousUser, newUser, ctx }: LinkArgs): Promise<void> {
  if (ctx.path !== SIGN_UP_PATH || newUser.user.isAnonymous) return
  const move = { where: { userId: anonymousUser.user.id }, data: { userId: newUser.user.id } }
  await prisma.$transaction([prisma.objective.updateMany(move), prisma.weekReview.updateMany(move)])
}
