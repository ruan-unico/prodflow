// Testa o service worker com um "Chrome de mentira" (mock).
// Os testes controlam o relógio, as abas e as janelas, disparam eventos
// e conferem o que foi salvo no storage.

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

const URL_SW = new URL("../src/background/service-worker.js", import.meta.url);
const WINDOW_ID_NONE = -1;

let relogio;
let navegador;
let dateNowOriginal;
let carregamentos = 0;

function criarEvento() {
  const ouvintes = [];
  return {
    addListener: (fn) => ouvintes.push(fn),
    disparar: (...args) => ouvintes.map((fn) => fn(...args)),
  };
}

function criarArea(dados) {
  return {
    get: async (chave) => (chave in dados ? { [chave]: structuredClone(dados[chave]) } : {}),
    set: async (objeto) => Object.assign(dados, structuredClone(objeto)),
    remove: async (chave) => { delete dados[chave]; },
  };
}

function criarNavegador() {
  const estado = {
    janelas: [{ id: 1, focused: true }],
    abas: [],
    ocioso: "active",
    local: {},
    session: {},
    alarmes: {},
  };

  const eventos = {
    onActivated: criarEvento(),
    onUpdated: criarEvento(),
    onRemoved: criarEvento(),
    onFocusChanged: criarEvento(),
    onIdle: criarEvento(),
    onAlarm: criarEvento(),
    onMessage: criarEvento(),
    onInstalled: criarEvento(),
    onStartup: criarEvento(),
  };

  // Recria o objeto global "chrome" (como se o service worker reiniciasse),
  // mantendo os dados do storage e o estado das abas.
  function montarChrome() {
    for (const chave of Object.keys(eventos)) eventos[chave] = criarEvento();
    globalThis.chrome = {
      windows: {
        WINDOW_ID_NONE,
        getLastFocused: async () => {
          const focada = estado.janelas.find((j) => j.focused);
          return focada ? { ...focada } : { ...estado.janelas[0], focused: false };
        },
        onFocusChanged: eventos.onFocusChanged,
      },
      tabs: {
        query: async ({ active, windowId }) =>
          estado.abas.filter((a) => a.active === active && a.windowId === windowId).map((a) => ({ ...a })),
        onActivated: eventos.onActivated,
        onUpdated: eventos.onUpdated,
        onRemoved: eventos.onRemoved,
      },
      idle: {
        setDetectionInterval: () => {},
        queryState: async () => estado.ocioso,
        onStateChanged: eventos.onIdle,
      },
      alarms: {
        get: async (nome) => estado.alarmes[nome],
        create: (nome, opcoes) => { estado.alarmes[nome] = { name: nome, ...opcoes }; },
        onAlarm: eventos.onAlarm,
      },
      storage: {
        local: criarArea(estado.local),
        session: criarArea(estado.session),
      },
      runtime: {
        onMessage: eventos.onMessage,
        onInstalled: eventos.onInstalled,
        onStartup: eventos.onStartup,
      },
    };
  }

  return { estado, eventos, montarChrome };
}

// Carrega uma instância nova do service worker
async function iniciarServiceWorker() {
  navegador.montarChrome();
  carregamentos += 1;
  await import(`${URL_SW.href}?instancia=${carregamentos}`);
}

// Espera a fila de tarefas do service worker esvaziar
const esperar = () => new Promise((resolve) => setTimeout(resolve, 0));

function avancar(segundos) {
  relogio += segundos * 1000;
}

function abrirAba(id, url, { janela = 1, ativa = true } = {}) {
  if (ativa) navegador.estado.abas.forEach((a) => { if (a.windowId === janela) a.active = false; });
  navegador.estado.abas.push({ id, windowId: janela, url, active: ativa, audible: false });
}

async function ativarAba(id) {
  const aba = navegador.estado.abas.find((a) => a.id === id);
  navegador.estado.abas.forEach((a) => { if (a.windowId === aba.windowId) a.active = a.id === id; });
  navegador.eventos.onActivated.disparar({ tabId: id, windowId: aba.windowId });
  await esperar();
}

const tempos = () => navegador.estado.local.temposPorDominio || {};

beforeEach(async () => {
  relogio = 1_000_000;
  dateNowOriginal = Date.now;
  Date.now = () => relogio;
  navegador = criarNavegador();
  await iniciarServiceWorker();
});

afterEach(() => {
  Date.now = dateNowOriginal;
});

test("soma o tempo por site ao trocar de aba", async () => {
  abrirAba(1, "https://www.youtube.com/watch?v=1");
  abrirAba(2, "https://github.com/ruan", { ativa: false });
  await ativarAba(1);

  avancar(30);
  await ativarAba(2);
  avancar(10);
  await ativarAba(1);

  assert.deepEqual(tempos(), { "youtube.com": 30, "github.com": 10 });
});

test("duas abas do mesmo site somam no mesmo item", async () => {
  abrirAba(1, "https://youtube.com/a");
  abrirAba(2, "https://www.youtube.com/b", { ativa: false });
  abrirAba(3, "https://github.com", { ativa: false });
  await ativarAba(1);

  avancar(20);
  await ativarAba(2); // mesmo site: a sessão continua
  avancar(15);
  await ativarAba(3);

  assert.deepEqual(tempos(), { "youtube.com": 35 });
});

test("navegar para outro site na mesma aba separa os tempos", async () => {
  abrirAba(1, "https://youtube.com");
  await ativarAba(1);

  avancar(12);
  navegador.estado.abas[0].url = "https://github.com";
  navegador.eventos.onUpdated.disparar(1, { url: "https://github.com" }, navegador.estado.abas[0]);
  await esperar();
  avancar(8);

  navegador.estado.janelas[0].focused = false;
  navegador.eventos.onFocusChanged.disparar(WINDOW_ID_NONE);
  await esperar();

  assert.deepEqual(tempos(), { "youtube.com": 12, "github.com": 8 });
});

test("para de contar quando o usuário sai do Chrome", async () => {
  abrirAba(1, "https://youtube.com");
  await ativarAba(1);
  avancar(10);

  navegador.estado.janelas[0].focused = false;
  navegador.eventos.onFocusChanged.disparar(WINDOW_ID_NONE);
  await esperar();
  avancar(600); // 10 minutos em outro programa

  navegador.estado.janelas[0].focused = true;
  navegador.eventos.onFocusChanged.disparar(1);
  await esperar();

  assert.deepEqual(tempos(), { "youtube.com": 10 });
});

test("trocar entre janelas do Chrome salva a aba da janela anterior", async () => {
  navegador.estado.janelas.push({ id: 2, focused: false });
  abrirAba(1, "https://youtube.com", { janela: 1 });
  abrirAba(2, "https://github.com", { janela: 2 });
  await ativarAba(1);

  avancar(25);
  navegador.estado.janelas[0].focused = false;
  navegador.estado.janelas[1].focused = true;
  navegador.eventos.onFocusChanged.disparar(2);
  await esperar();

  assert.deepEqual(tempos(), { "youtube.com": 25 });
});

test("não perde tempo quando o Chrome desliga o service worker", async () => {
  abrirAba(1, "https://youtube.com");
  abrirAba(2, "https://github.com", { ativa: false });
  await ativarAba(1);
  avancar(40);

  await iniciarServiceWorker(); // service worker "morreu" e voltou: variáveis zeradas
  await ativarAba(2);

  assert.deepEqual(tempos(), { "youtube.com": 40 });
});

test("ausência pausa a contagem, mas vídeo tocando continua contando", async () => {
  abrirAba(1, "https://news.com");
  abrirAba(2, "https://youtube.com", { ativa: false });
  await ativarAba(1);
  avancar(30);

  navegador.estado.ocioso = "idle";
  navegador.eventos.onIdle.disparar("idle");
  await esperar();
  avancar(900); // ausente
  navegador.estado.ocioso = "active";
  navegador.eventos.onIdle.disparar("active");
  await esperar();

  navegador.estado.abas[1].audible = true;
  await ativarAba(2);
  avancar(60);
  navegador.estado.ocioso = "idle"; // parado assistindo vídeo
  navegador.eventos.onIdle.disparar("idle");
  await esperar();
  avancar(60);
  navegador.eventos.onAlarm.disparar({ name: "checkpoint" });
  await esperar();

  assert.deepEqual(tempos(), { "news.com": 30, "youtube.com": 120 });
});

test("checkpoint salva o progresso a cada minuto e ignora o tempo de suspensão", async () => {
  abrirAba(1, "https://youtube.com");
  await ativarAba(1);

  avancar(60);
  navegador.eventos.onAlarm.disparar({ name: "checkpoint" });
  await esperar();
  assert.deepEqual(tempos(), { "youtube.com": 60 });

  avancar(3 * 3600); // notebook ficou 3h fechado: nenhum alarme rodou
  navegador.eventos.onAlarm.disparar({ name: "checkpoint" });
  await esperar();
  assert.equal(tempos()["youtube.com"] <= 60 + 120, true);
});

test("eventos simultâneos não apagam a soma um do outro", async () => {
  abrirAba(1, "https://a.com");
  abrirAba(2, "https://b.com", { ativa: false });
  await ativarAba(1);
  avancar(10);

  // Três eventos de uma vez, sem esperar entre eles
  navegador.estado.abas.forEach((a) => { a.active = a.id === 2; });
  navegador.eventos.onActivated.disparar({ tabId: 2 });
  navegador.eventos.onAlarm.disparar({ name: "checkpoint" });
  navegador.eventos.onFocusChanged.disparar(1);
  await esperar();
  avancar(5);
  await ativarAba(1);

  assert.deepEqual(tempos(), { "a.com": 10, "b.com": 5 });
});

test("zerar apaga os tempos e reinicia a contagem do site atual", async () => {
  abrirAba(1, "https://youtube.com");
  await ativarAba(1);
  avancar(50);
  navegador.eventos.onAlarm.disparar({ name: "checkpoint" });
  await esperar();

  let resposta;
  navegador.eventos.onMessage.disparar({ tipo: "zerar" }, {}, (r) => { resposta = r; });
  await esperar();
  assert.deepEqual(resposta, { ok: true });
  assert.deepEqual(tempos(), {});

  avancar(7);
  navegador.eventos.onAlarm.disparar({ name: "checkpoint" });
  await esperar();
  assert.deepEqual(tempos(), { "youtube.com": 7 });
});

test("ao atualizar da v1, remove os dados antigos salvos por ID de aba", async () => {
  navegador.estado.local.tempos = { 123: 50, 456: 20 };
  navegador.eventos.onInstalled.disparar({ reason: "update" });
  await esperar();

  assert.equal("tempos" in navegador.estado.local, false);
  assert.ok(navegador.estado.alarmes.checkpoint, "deve criar o alarme de checkpoint");
});
