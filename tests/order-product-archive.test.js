import assert from "node:assert/strict";
import test from "node:test";
import { orderProductEntries } from "../src/lib/order-product-archive.js";

const items = [
  { id: "b1", area: "banner", product_name: "Banner 60x90 cm", qty: 2, variant: "Lona · Ilhós",
    options: { material_id: "lona", art_file_uri: "vps:arte", art_original_name: "arte.pdf", instructions: "Frase da festa" } },
  { id: "b2", area: "banner", product_name: "Banner", qty: 1,
    options: { width_cm: 60, height_cm: 90, art_mode: "equipe", material_name: "Vinil", finish_names: ["Bastão", "Cordão"] } },
  { id: "p1", area: "personalizado", product_name: "Caneca Porcelana", qty: 1, options: { text_values: { Frase: "Feliz dia, Ana!" } } },
  { id: "p2", area: "personalizado", product_name: "Caneca Porcelana", qty: 1, options: { text_values: { Frase: "Parabéns, João!" } } },
];
const photos = [
  { position: "002", photo: { area: "personalizado", item_id: "p2", size_name: "Verso", original_file_uri: "vps:joao" } },
  { position: "003", photo: { area: "personalizado", item_id: "p1", size_name: "Frente", original_file_uri: "vps:ana" } },
];

test("banner recebe nome pelo tamanho e ficha com as escolhas de cada item", () => {
  const result = orderProductEntries(items, photos, { areas: ["banner"], originals: false, prints: true });
  assert.deepEqual(result.map(({ name }) => name), [
    "Banner/Banner 60x90", "Banner/Banner 60x90 - Detalhes.txt", "Banner/Banner 60x90 (2) - Detalhes.txt",
  ]);
  assert.equal(result[0].fallback, "pdf");
  assert.match(result[1].text, /Quantidade: 2\r\nMedidas: 60x90 cm\r\nMaterial: Lona\r\nAcabamento: Ilhós/);
  assert.match(result[1].text, /Instruções: Frase da festa/);
  assert.match(result[2].text, /Material: Vinil\r\nAcabamento: Bastão, Cordão\r\nArte: Criação pela equipe/);
});

test("personalizados iguais separam as fotos e o texto pelo identificador do item", () => {
  const result = orderProductEntries(items, photos, { areas: ["personalizado"], originals: false, prints: true });
  const first = "Personalizados/1 Caneca Porcelana (Item 1)";
  const second = "Personalizados/1 Caneca Porcelana (Item 2)";
  assert.deepEqual(result.map(({ name }) => name), [
    first + "/Foto 003 - Frente", first + "/Detalhes do pedido.txt",
    second + "/Foto 002 - Verso", second + "/Detalhes do pedido.txt",
  ]);
  assert.equal(result[0].uri, "vps:ana");
  assert.match(result[1].text, /Frase: Feliz dia, Ana!/);
  assert.equal(result[2].uri, "vps:joao");
  assert.match(result[3].text, /Frase: Parabéns, João!/);
});

test("personalizado sem texto mantém as fotos e o download de originais contém os arquivos", () => {
  const product = { ...items[2], options: {}, product_name: "Caneca/Porcelana", qty: 3 };
  const result = orderProductEntries([items[0], product], [photos[1]], { areas: null, originals: true, prints: false });
  assert.deepEqual(result.map(({ name }) => name), [
    "Banner/Banner 60x90", "Personalizados/3 Caneca Porcelana/Foto 003 - Frente",
  ]);
  assert(result.every((entry) => entry.uri));
});
