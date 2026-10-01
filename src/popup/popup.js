import { formatarTempo, montarRanking } from "../shared/utils.js";

const CHAVE_TEMPOS = "temposPorDominio";
const CHAVE_SESSAO = "sessao";

const lista = document.getElementById("lista");
const totalEl = document.getElementById("total");
const botaoZerar = document.getElementById("btn-zerar");

// Cópia local dos dados. O popup redesenha a cada segundo a partir dela,
// sem precisar ler o storage toda hora.
let tempos = {};
let sessao = null;

async function carregarDados() {
  const [local, sessaoSalva] = await Promise.all([
    chrome.storage.local.get(CHAVE_TEMPOS),
    chrome.storage.session.get(CHAVE_SESSAO),
  ]);
  tempos = local[CHAVE_TEMPOS] || {};
  sessao = sessaoSalva[CHAVE_SESSAO] || null;
  desenhar();
}

// Cria um elemento com classe e texto.
// Usamos textContent (e nunca innerHTML) com dados vindos de sites:
// assim, mesmo que um site tenha um nome malicioso com HTML,
// ele é mostrado como texto e não executado (proteção contra XSS).
function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function criarItem({ dominio, segundos }, maiorTempo, totalSegundos) {
  const item = criar("div", "item");
  const ativo = sessao?.dominio === dominio;
  if (ativo) item.classList.add("ativo");

  const info = criar("div", "info");
  const textos = criar("div", "textos");

  const titulo = criar("span", "titulo", dominio);
  titulo.title = dominio;
  textos.append(titulo);

  const detalhe = criar("span", "detalhe", `${Math.round((segundos / totalSegundos) * 100)}% do total`);
  if (ativo) detalhe.prepend(criar("span", "agora", "● agora · "));
  textos.append(detalhe);

  info.append(textos, criar("span", "tempo", formatarTempo(segundos)));

  const fundo = criar("div", "barra-fundo");
  const barra = criar("div", "barra-progresso");
  barra.style.width = `${Math.max(2, Math.round((segundos / maiorTempo) * 100))}%`;
  fundo.append(barra);

  item.append(info, fundo);
  return item;
}

function desenhar() {
  const ranking = montarRanking(tempos, sessao, Date.now());

  if (ranking.length === 0) {
    const vazio = criar("p", "vazio", "Nenhum site rastreado ainda.");
    vazio.append(document.createElement("br"), "Navegue um pouco e volte aqui! 😄");
    lista.replaceChildren(vazio);
    totalEl.textContent = "0s";
    return;
  }

  const totalSegundos = ranking.reduce((soma, site) => soma + site.segundos, 0);
  const maiorTempo = ranking[0].segundos;

  lista.replaceChildren(...ranking.map((site) => criarItem(site, maiorTempo, totalSegundos)));
  totalEl.textContent = `Total: ${formatarTempo(totalSegundos)}`;
}

botaoZerar.addEventListener("click", async () => {
  if (!confirm("Deseja zerar todos os tempos?")) return;
  // Quem mexe nos dados é o service worker; o popup só pede.
  // Assim evitamos os dois gravando ao mesmo tempo.
  await chrome.runtime.sendMessage({ tipo: "zerar" });
  await carregarDados();
});

// Se o service worker salvar algo enquanto o popup está aberto, atualiza
chrome.storage.onChanged.addListener((mudancas) => {
  if (CHAVE_TEMPOS in mudancas || CHAVE_SESSAO in mudancas) carregarDados();
});

// O site atual continua contando enquanto o popup está aberto
setInterval(desenhar, 1000);

carregarDados();
