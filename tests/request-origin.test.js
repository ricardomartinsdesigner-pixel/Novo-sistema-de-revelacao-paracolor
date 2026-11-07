import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedRequestOrigin } from "../src/lib/request-origin.js";

function request(url, headers = {}) {
  return new Request(url, { headers });
}

test("aceita o domínio público HTTPS informado pelo proxy reverso", () => {
  const req = request("http://app:3000/api/auth/register", {
    host: "app:3000",
    "x-forwarded-host": "www.paracolor.duckdns.org",
    "x-forwarded-proto": "https",
  });
  assert.equal(isAllowedRequestOrigin(req, "https://www.paracolor.duckdns.org"), true);
});

test("aceita a URL pública configurada mesmo com a URL interna do container", () => {
  const req = request("http://app:3000/api/auth/register", { host: "app:3000" });
  assert.equal(isAllowedRequestOrigin(req, "https://loja.exemplo.com", "https://loja.exemplo.com/"), true);
});

test("recusa origem externa e origens malformadas", () => {
  const req = request("http://app:3000/api/auth/register", {
    host: "app:3000",
    "x-forwarded-host": "loja.exemplo.com",
    "x-forwarded-proto": "https",
  });
  assert.equal(isAllowedRequestOrigin(req, "https://site-malicioso.example"), false);
  assert.equal(isAllowedRequestOrigin(req, "null"), false);
});

test("permite requisições sem cabeçalho Origin, como clientes não navegador", () => {
  const req = request("http://localhost:3000/api/auth/register");
  assert.equal(isAllowedRequestOrigin(req, ""), true);
});
