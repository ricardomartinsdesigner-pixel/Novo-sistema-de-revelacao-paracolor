import test from "node:test";
import assert from "node:assert/strict";
import { createSmtpMessage } from "../src/lib/smtp-message.server.js";

const baseMessage = {
  to: "  cliente@example.com  ",
  from_email: "  loja@example.com  ",
  from_name: "Paracolor",
  subject: "Teste SMTP",
  text: "Mensagem de teste",
  html: "<p>Mensagem de teste</p>",
};

test("normaliza espaços de destinatário e remetente antes da validação SMTP", () => {
  const message = createSmtpMessage(baseMessage);
  assert.equal(message.to, "cliente@example.com");
  assert.equal(message.from_email, "loja@example.com");
  assert.match(message.data, /To: <cliente@example\.com>/);
});

test("ignora Reply-To opcional inválido para não bloquear o envio", () => {
  const message = createSmtpMessage({ ...baseMessage, reply_to: " endereço inválido " });
  assert.equal(message.reply_to, "");
  assert.doesNotMatch(message.data, /^Reply-To:/m);
});
