import type { Mail } from '@/lib/mailer'

/** How long the link lives, in seconds. Said in the e-mail, so keep them together. */
export const RESET_TOKEN_TTL_SECONDS = 60 * 60

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The "choose a new password" e-mail, in plain text and a small HTML version. */
export function passwordResetEmail({ name, email, url }: { name: string; email: string; url: string }): Mail {
  const hello = name.trim() ? `Olá, ${name.trim()}!` : 'Olá!'
  const hours = RESET_TOKEN_TTL_SECONDS / 3600
  const validity = `O link vale por ${hours} ${hours === 1 ? 'hora' : 'horas'} e só pode ser usado uma vez.`
  const ignore = 'Se não foi você, é só ignorar este e-mail: sua senha continua a mesma.'

  const text = [
    hello,
    '',
    'Recebemos um pedido para criar uma nova senha na sua conta do Metas. Abra o link abaixo para escolher a nova senha:',
    '',
    url,
    '',
    validity,
    ignore,
  ].join('\n')

  const safeUrl = escapeHtml(url)
  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4f6f9;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#1b1f27;line-height:1.5">
<div style="max-width:28rem;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #dde2ea;border-radius:12px">
<p style="margin:0 0 12px;font-size:18px;font-weight:600">${escapeHtml(hello)}</p>
<p style="margin:0 0 16px">Recebemos um pedido para criar uma nova senha na sua conta do Metas.</p>
<p style="margin:0 0 16px"><a href="${safeUrl}" style="display:inline-block;padding:10px 16px;background:#2563c9;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600">Escolher nova senha</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#5b6575">Se o botão não abrir, copie este endereço no navegador:<br><span style="word-break:break-all">${safeUrl}</span></p>
<p style="margin:16px 0 0;font-size:13px;color:#5b6575">${validity}<br>${ignore}</p>
</div></body></html>`

  return { to: email, subject: 'Crie uma nova senha no Metas', text, html }
}
