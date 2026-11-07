import { loadSmtpConfig } from "@/lib/smtp-config.server";
import { SmtpConnection, SmtpError } from "@/lib/smtp-connection.server";
import { createSmtpMessage, smtpBase64 } from "@/lib/smtp-message.server";

async function authenticate(connection, capabilities, config) {
  const methods = /(?:^|\n)AUTH[= ]([^\n]+)/i.exec(capabilities)?.[1].toUpperCase().split(/\s+/) || [];
  if (methods.includes("PLAIN")) {
    await connection.command(`AUTH PLAIN ${smtpBase64(`\0${config.username}\0${config.password}`)}`, [235], "a autenticação");
  } else if (methods.includes("LOGIN")) {
    await connection.command("AUTH LOGIN", [334], "a autenticação");
    await connection.command(smtpBase64(config.username), [334], "o usuário");
    await connection.command(smtpBase64(config.password), [235], "a autenticação");
  } else {
    throw new SmtpError("O servidor não oferece autenticação SMTP por usuário e senha (LOGIN ou PLAIN). Confira se esse acesso está habilitado no provedor.");
  }
}

export async function sendStoreEmail(base44, settings, input) {
  const config = await loadSmtpConfig(base44);
  const message = createSmtpMessage({
    ...input,
    from_email: config.from_email,
    from_name: settings.email_from_name || settings.store_name || "Paracolor",
    reply_to: settings.email_reply_to || "",
  });
  let connection;
  let timer;
  try {
    connection = new SmtpConnection(config);
    const deliver = async () => {
      await connection.socket.opened;
      await connection.reply([220], "a conexão");
      const hello = `EHLO ${config.from_email.split("@")[1]}`;
      let capabilities = await connection.command(hello, [250], "a apresentação");
      if (config.security === "starttls") {
        if (!/(?:^|\n)STARTTLS(?:\s|$)/i.test(capabilities)) throw new SmtpError("O servidor não oferece STARTTLS. Confira a porta e a segurança informadas.");
        await connection.upgrade();
        capabilities = await connection.command(hello, [250], "a conexão segura");
      }
      await authenticate(connection, capabilities, config);
      await connection.command(`MAIL FROM:<${message.from_email}>`, [250], "o remetente");
      await connection.command(`RCPT TO:<${message.to}>`, [250, 251], "o destinatário");
      await connection.command("DATA", [354], "a mensagem");
      await connection.command(message.data, [250], "o envio da mensagem");
    };
    await Promise.race([
      deliver(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new SmtpError("O servidor SMTP não respondeu em 25 segundos. Confira o servidor, a porta e a segurança.")), 25000); }),
    ]);
    return { accepted: true };
  } catch (error) {
    if (error instanceof SmtpError) throw error;
    throw new SmtpError("Não foi possível conectar ao SMTP com segurança. Confira servidor, porta, certificado e disponibilidade do provedor.");
  } finally {
    clearTimeout(timer);
    if (connection) await connection.close();
  }
}