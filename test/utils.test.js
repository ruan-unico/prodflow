import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarTempo, extrairDominio, montarRanking } from "../src/shared/utils.js";

test("formatarTempo mostra só as unidades que fazem sentido", () => {
  assert.equal(formatarTempo(0), "0s");
  assert.equal(formatarTempo(42), "42s");
  assert.equal(formatarTempo(125), "2m 5s");
  assert.equal(formatarTempo(3600), "1h 0m");
  assert.equal(formatarTempo(4805), "1h 20m");
});

test("formatarTempo não quebra com valores estranhos", () => {
  assert.equal(formatarTempo(-10), "0s");
  assert.equal(formatarTempo(59.9), "59s");
});

test("extrairDominio agrupa variações do mesmo site", () => {
  assert.equal(extrairDominio("https://www.youtube.com/watch?v=abc"), "youtube.com");
  assert.equal(extrairDominio("https://youtube.com/"), "youtube.com");
  assert.equal(extrairDominio("http://github.com/ruan"), "github.com");
});

test("extrairDominio ignora páginas que não são sites", () => {
  assert.equal(extrairDominio("chrome://newtab/"), null);
  assert.equal(extrairDominio("chrome-extension://abc/popup.html"), null);
  assert.equal(extrairDominio("file:///C:/notas.txt"), null);
  assert.equal(extrairDominio("isso não é uma url"), null);
  assert.equal(extrairDominio(undefined), null);
});

test("montarRanking ordena do maior para o menor", () => {
  const ranking = montarRanking({ "a.com": 10, "b.com": 50, "c.com": 30 }, null, 0);
  assert.deepEqual(ranking.map((s) => s.dominio), ["b.com", "c.com", "a.com"]);
});

test("montarRanking soma o tempo do site que ainda está contando", () => {
  const agora = 100_000;
  const sessao = { dominio: "a.com", inicio: agora - 25_000 };
  const ranking = montarRanking({ "a.com": 10, "b.com": 30 }, sessao, agora);
  assert.deepEqual(ranking, [
    { dominio: "a.com", segundos: 35 },
    { dominio: "b.com", segundos: 30 },
  ]);
});

test("montarRanking inclui um site novo que só existe na sessão atual", () => {
  const ranking = montarRanking({}, { dominio: "novo.com", inicio: 1_000 }, 6_000);
  assert.deepEqual(ranking, [{ dominio: "novo.com", segundos: 5 }]);
});
