🅿️ ProdFlow - Timer de Tempo por Aba

❓ O que é?
Uma extensão para o Chrome que monitora quanto tempo você passa em cada aba do navegador, agrupando por site. No popup você vê um ranking com barras de progresso e o tempo total da sessão, além de um botão pra zerar tudo quando quiser.

❓ Como foi feito:
Usei a API chrome.tabs pra detectar quando o usuário muda de aba e registrei os timestamps com o chrome.storage.local, o que faz os dados sobreviverem entre sessões sem precisar de backend nenhum. O popup consome esses dados e monta a interface dinamicamente com HTML, CSS e JS puro - sem frameworks.

📚 O que aprendi/desenvolvi nesse projeto:

- Como o ciclo de vida de extensões Chrome funciona na prática (background scripts, service workers, manifest v3)
- Lidar com eventos assíncronos de forma mais organizada - tabs.onActivated, tabs.onUpdated e windows.onFocusChanged todos interagindo ao mesmo tempo foi um desafio
- Persistência de dados com chrome.storage e como evitar condição de corrida ao atualizar o objeto de tempos
- A diferença entre o contexto do popup e do service worker (eles não compartilham memória, aprendi isso na prática rs)
- Importância de testar em edge cases: aba fechada antes de salvar, janela perdendo foco, múltiplas janelas abertas
