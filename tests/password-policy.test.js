import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedCustomerPassword } from "../src/lib/password-policy.js";

test("senha simples de oito caracteres é permitida", () => {
  assert.equal(isAllowedCustomerPassword("abcdefgh"), true);
  assert.equal(isAllowedCustomerPassword("12345678"), true);
});

test("senha curta, longa demais ou não textual é recusada", () => {
  assert.equal(isAllowedCustomerPassword("abc1234"), false);
  assert.equal(isAllowedCustomerPassword("x".repeat(161)), false);
  assert.equal(isAllowedCustomerPassword(null), false);
});
