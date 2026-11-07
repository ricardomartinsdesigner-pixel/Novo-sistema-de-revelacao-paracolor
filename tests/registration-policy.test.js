import test from "node:test";
import assert from "node:assert/strict";
import { mayRegisterWithoutEmailConfirmation } from "../src/lib/registration-policy.js";

test("permite cadastro de cliente quando o envio de e-mail não está disponível", () => {
  assert.equal(mayRegisterWithoutEmailConfirmation({ code: "SMTP_NOT_CONFIGURED" }), true);
  assert.equal(mayRegisterWithoutEmailConfirmation({ code: "EMAIL_DISABLED" }), true);
});

test("não ignora falhas de autenticação SMTP nem confirmação de conta gerenciada", () => {
  assert.equal(mayRegisterWithoutEmailConfirmation({ code: "SMTP_AUTH_FAILED" }), false);
  assert.equal(mayRegisterWithoutEmailConfirmation(new Error("Falha SMTP")), false);
  assert.equal(mayRegisterWithoutEmailConfirmation({ code: "SMTP_NOT_CONFIGURED" }, true), false);
});
