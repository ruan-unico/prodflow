// rastreia qual aba está ativa e quanto tempo o usuário ficou nela


let activeTabId = null;      // Guarda o ID da aba que está aberta agora
let startTime = null;        // Guarda o momento em que a aba ficou ativa


// Objetivo: calcular quanto tempo passou desde que a aba ficou ativa e somar esse valor ao total já salvo para aquela aba

function salvarTempo(tabId) {
  // Se não tem aba ativa ou não tem horário de início, não faz nada
  if (!tabId || !startTime) return;

  // Calcula quantos segundos se passaram desde que a aba ficou ativa
  const agora = Date.now();                    
  const segundosPassados = Math.floor((agora - startTime) / 1000); // Converte para segundos

  // Só salva se passou pelo menos 1 segundo (evita salvar zero)
  if (segundosPassados < 1) return;

  // Busca os dados já salvos no armazenamento local da extensão
  chrome.storage.local.get(["tempos"], (resultado) => {
    // Se já tem dados salvos, usa eles. Se não, começa com um objeto vazio
    const tempos = resultado.tempos || {};

    // Soma o tempo novo ao tempo anterior daquela aba
    // Se a aba não tinha tempo salvo ainda, começa do zero (|| 0)
    tempos[tabId] = (tempos[tabId] || 0) + segundosPassados;

    // Salva o objeto atualizado de volta no armazenamento
    chrome.storage.local.set({ tempos });
  });
}

// Dispara quando o usuário troca de aba

chrome.tabs.onActivated.addListener((activeInfo) => {
  // Antes de trocar, salva o tempo da aba que estava ativa ANTES
  salvarTempo(activeTabId);

  // Agora atualiza qual é a aba ativa
  activeTabId = activeInfo.tabId;

  // Marca o novo horário de início para a nova aba
  startTime = Date.now();
});

// Dispara quando o usuário minimiza o Chrome ou troca de janela

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Usuário saiu do Chrome salva o tempo e para de contar
    salvarTempo(activeTabId);
    startTime = null; // Para o cronômetro
  } else {
    // Usuário voltou para o Chrome reinicia o contador
    startTime = Date.now();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  // Se a aba fechada era a ativa, salva o tempo dela
  if (tabId === activeTabId) {
    salvarTempo(activeTabId);
    activeTabId = null;
    startTime = null;
  }
});
