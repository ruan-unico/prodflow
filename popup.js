// Converte um número de segundos em formato legível: "1h 20m 5s"
function formatarTempo(segundos) {
  const horas = Math.floor(segundos / 3600);           // Quantas horas cheias
  const minutos = Math.floor((segundos % 3600) / 60);  // Minutos restantes
  const segs = segundos % 60;                          // Segundos restantes

  // Monta a string de exibição, incluindo apenas o que for maior que zero
  let resultado = "";
  if (horas > 0) resultado += `${horas}h `;
  if (minutos > 0) resultado += `${minutos}m `;
  resultado += `${segs}s`;

  return resultado;
}

// Busca o título e URL de uma aba pelo seu ID
// Retorna uma Promise (resposta assíncrona) com os dados
function pegarNomeDaAba(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(Number(tabId), (tab) => {
      if (chrome.runtime.lastError || !tab) {
        // Se a aba foi fechada e não existe mais, retorna um texto padrão
        resolve({ titulo: "Aba fechada", url: "" });
      } else {
        // Extrai só o domínio da URL (ex: "youtube.com")
        let dominio = "";
        try {
          dominio = new URL(tab.url).hostname; // Pega só o endereço base
        } catch {
          dominio = tab.url; // Se falhar, usa a URL completa
        }
        resolve({
          titulo: tab.title || dominio, // Prioriza o título da aba
          url: dominio
        });
      }
    });
  });
}

// Lê os tempos salvos e monta a lista no popup

async function carregarDados() {
  const lista = document.getElementById("lista");       // Elemento da lista no HTML
  const totalEl = document.getElementById("total");    // Elemento do tempo total

  // Busca os tempos salvos no storage
  chrome.storage.local.get(["tempos"], async (resultado) => {
    const tempos = resultado.tempos || {}; // Se não tiver nada, usa objeto vazio

    // Se não tem nenhum dado ainda, mostra mensagem de espera
    if (Object.keys(tempos).length === 0) {
      lista.innerHTML = `<p class="vazio">Nenhuma aba rastreada ainda.<br>Navegue um pouco e volte aqui! 😄</p>`;
      return;
    }

    // Ordena as abas do maior tempo para o menor
    
    const ordenado = Object.entries(tempos).sort((a, b) => b[1] - a[1]);

    let totalSegundos = 0; // Vai somar o tempo de todas as abas
    lista.innerHTML = "";  // Limpa a lista antes de preencher

    // Calcula o maior tempo (para a barra de progresso)
    const maiorTempo = ordenado[0][1];

    // Para cada aba salva, cria um item visual na lista
    for (const [tabId, segundos] of ordenado) {
      totalSegundos += segundos;

      // Busca o nome e URL da aba
      const { titulo, url } = await pegarNomeDaAba(tabId);

      // Calcula a largura da barra de progresso em porcentagem
      const porcentagem = Math.round((segundos / maiorTempo) * 100);

      // Cria o elemento HTML do item
      const item = document.createElement("div");
      item.className = "item";
      item.innerHTML = `
        <div class="info">
          <div>
            <span class="titulo">${titulo}</span>
            <span class="url">${url}</span>
          </div>
          <span class="tempo">${formatarTempo(segundos)}</span>
        </div>
        <div class="barra-fundo">
          <div class="barra-progresso" style="width: ${porcentagem}%"></div>
        </div>
      `;

      lista.appendChild(item); // Adiciona o item na lista
    }

    // Exibe o tempo total de todas as abas somadas
    totalEl.textContent = `Total: ${formatarTempo(totalSegundos)}`;
  });
}

// Botão "Zerar" - limpa todos os dados salvos

document.getElementById("btn-zerar").addEventListener("click", () => {
  // Confirma com o usuário antes de apagar tudo
  if (confirm("Deseja zerar todos os tempos?")) {
    chrome.storage.local.remove("tempos", () => {
      carregarDados(); // Recarrega a lista (vai mostrar a mensagem vazia)
    });
  }
});

// Chama a função principal assim que o popup abre
carregarDados();
