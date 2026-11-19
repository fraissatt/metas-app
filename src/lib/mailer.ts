import nodemailer from 'nodemailer'

export type Mail = { to: string; subject: string; text: string; html: string }

type Env = Record<string, string | undefined>

/** The Gmail account and its app password; both must be set to send for real. */
export function mailConfig(env: Env = process.env): { user: string; pass: string } | null {
  const user = env.GMAIL_USER?.trim()
  const pass = env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '')
  return user && pass ? { user, pass } : null
}

/**
 * Whether e-mail can really be sent. The password recovery is offered only then:
 * without it a person would ask for a link that never arrives.
 */
export function isMailConfigured(env: Env = process.env): boolean {
  return mailConfig(env) !== null
}

/**
 * Sends through Gmail's SMTP with an app password. Without the two variables
 * nothing is sent and the app keeps working: in development the message goes to
 * the server console (so the reset link can be copied), in production a logged
 * error says why no e-mail left. Never throws for a missing configuration.
 */
export async function sendMail(mail: Mail, env: Env = process.env): Promise<void> {
  const config = mailConfig(env)
  if (!config) {
    if (env.NODE_ENV === 'production') {
      console.error('E-mail não enviado: GMAIL_USER e GMAIL_APP_PASSWORD não estão configurados.')
    } else {
      console.info(`[e-mail de desenvolvimento] Para: ${mail.to}\nAssunto: ${mail.subject}\n${mail.text}`)
    }
    return
  }

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: config,
    // Short, so a Gmail stall ends in a logged error and not in a request that hangs.
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 10_000,
  })
  await transport.sendMail({ from: `Metas <${config.user}>`, ...mail })
}
