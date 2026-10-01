// =====================================================================
// ProdFlow — service worker (roda em segundo plano)
//
// Ideia central: existe no máximo UMA "sessão" ativa por vez,
// ou seja, o site que está na aba ativa da janela em foco.
// Quando algo muda (troca de aba, de site, de janela, usuário ausente),
// encerramos a sessão atual (somando o tempo ao site) e abrimos outra.
//
// Por que a sessão fica em chrome.storage.session e não em variáveis?
// No Manifest V3 o Chrome DESLIGA o service worker após ~30s sem eventos.
// Tudo que estiver só em variáveis some. O storage.session sobrevive
// a esses desligamentos (e é limpo quando o navegador fecha).
// =====================================================================

import { extrairDominio } from "../shared/utils.js";

const CHAVE_TEMPOS = "temposPorDominio"; // storage.local  -> { "youtube.com": 1520, ... }
const CHAVE_SESSAO = "sessao";           // storage.session -> { dominio, inicio }

const SEGUNDOS_PARA_OCIOSO = 300;        // 5 min sem mexer = ausente
const ALARME_CHECKPOINT = "checkpoint";  // salva o progresso a cada minuto

// Se passar mais que isso entre dois salvamentos, o computador provavelmente
// dormiu (o alarme não conseguiu rodar). Não contamos esse "buraco".
const MAXIMO_POR_SALVAMENTO = 120;

chrome.idle.setDetectionInterval(SEGUNDOS_PARA_OCIOSO);

// ---------------------------------------------------------------------
// Fila de execução
// Vários eventos podem chegar quase juntos. Como ler e gravar no storage
// é assíncrono, duas operações em paralelo poderiam ler o mesmo valor
// antigo e uma apagar a soma da outra (race condition).
// A fila garante que uma operação só começa quando a anterior terminou.
// ---------------------------------------------------------------------
let fila = Promise.resolve();

function agendar(tarefa) {
  fila = fila.then(tarefa).catch((erro) => console.error("[ProdFlow]", erro));
  return fila;
}

// ---------------------------------------------------------------------
// Leitura do estado atual do navegador
// ---------------------------------------------------------------------

// Descobre qual site o usuário está vendo AGORA (ou null se nenhum)
async function dominioEmFoco() {
  const janela = await chrome.windows.getLastFocused();
  if (!janela || !janela.focused) return null; // usuário está fora do Chrome

  const [aba] = await chrome.tabs.query({ active: true, windowId: janela.id });
  if (!aba) return null;

  const estado = await chrome.idle.queryState(SEGUNDOS_PARA_OCIOSO);
  if (estado === "locked") return null;          // tela bloqueada
  if (estado === "idle" && !aba.audible) return null; // ausente (mas vídeo tocando conta)

  return extrairDominio(aba.url);
}

// ---------------------------------------------------------------------
// Sessão
// ---------------------------------------------------------------------

async function lerSessao() {
  const dados = await chrome.storage.session.get(CHAVE_SESSAO);
  return dados[CHAVE_SESSAO] || null;
}

async function gravarSessao(sessao) {
  await chrome.storage.session.set({ [CHAVE_SESSAO]: sessao });
}

// Soma ao site o tempo decorrido desde o início da sessão
async function contabilizar(sessao, agora) {
  if (!sessao?.dominio || !sessao.inicio) return;

  const decorrido = Math.floor((agora - sessao.inicio) / 1000);
  const segundos = Math.min(Math.max(decorrido, 0), MAXIMO_POR_SALVAMENTO);
  if (segundos < 1) return;

  const dados = await chrome.storage.local.get(CHAVE_TEMPOS);
  const tempos = dados[CHAVE_TEMPOS] || {};
  tempos[sessao.dominio] = (tempos[sessao.dominio] || 0) + segundos;
  await chrome.storage.local.set({ [CHAVE_TEMPOS]: tempos });
}

// Compara o que o usuário está vendo com a sessão salva e ajusta
async function sincronizar() {
  const agora = Date.now();
  const [dominio, sessao] = await Promise.all([dominioEmFoco(), lerSessao()]);

  if (sessao && sessao.dominio === dominio) return; // nada mudou, segue contando

  await contabilizar(sessao, agora);
  await gravarSessao(dominio ? { dominio, inicio: agora } : null);
}

// Salva o progresso sem encerrar a sessão (para não perder tempo
// se o navegador fechar de repente)
async function checkpoint() {
  const agora = Date.now();
  const sessao = await lerSessao();
  if (sessao) {
    await contabilizar(sessao, agora);
    await gravarSessao({ ...sessao, inicio: agora });
  }
  await sincronizar();
}

async function zerar() {
  await chrome.storage.local.remove(CHAVE_TEMPOS);
  const sessao = await lerSessao();
  if (sessao) await gravarSessao({ ...sessao, inicio: Date.now() });
}

async function garantirAlarme() {
  const existente = await chrome.alarms.get(ALARME_CHECKPOINT);
  if (!existente) chrome.alarms.create(ALARME_CHECKPOINT, { periodInMinutes: 1 });
}

// ---------------------------------------------------------------------
// Eventos
// No MV3 os listeners precisam ser registrados no "nível de cima" do
// arquivo, para o Chrome saber quem acordar quando o evento acontecer.
// ---------------------------------------------------------------------

// Trocou de aba
chrome.tabs.onActivated.addListener(() => agendar(sincronizar));

// Navegou para outro site na mesma aba (ex.: youtube.com -> github.com)
chrome.tabs.onUpdated.addListener((_tabId, mudanca, aba) => {
  if (mudanca.url && aba.active) agendar(sincronizar);
});

// Fechou uma aba
chrome.tabs.onRemoved.addListener(() => agendar(sincronizar));

// Trocou de janela ou saiu do Chrome
chrome.windows.onFocusChanged.addListener(() => agendar(sincronizar));

// Ficou ausente, voltou ou bloqueou a tela
chrome.idle.onStateChanged.addListener(() => agendar(sincronizar));

// Salvamento periódico
chrome.alarms.onAlarm.addListener((alarme) => {
  if (alarme.name === ALARME_CHECKPOINT) agendar(checkpoint);
});

// Pedido do popup para zerar os tempos
chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  if (mensagem?.tipo !== "zerar") return false;
  agendar(zerar).then(() => responder({ ok: true }));
  return true; // avisa o Chrome que a resposta é assíncrona
});

chrome.runtime.onInstalled.addListener((detalhes) => {
  if (detalhes.reason === "update") {
    // A versão 1.x salvava por ID de aba ("tempos"), formato que não serve mais
    chrome.storage.local.remove("tempos");
  }
  agendar(garantirAlarme);
  agendar(sincronizar);
});

chrome.runtime.onStartup.addListener(() => {
  agendar(garantirAlarme);
  agendar(sincronizar);
});
