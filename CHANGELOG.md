# Changelog

## 2.0.0 — 2026-10-01

### Corrigido
- O tempo agora é agrupado **por site**, como o README prometia. Antes era salvo por ID de aba, então o mesmo site aparecia repetido e o histórico virava "Aba fechada" depois de reiniciar o navegador.
- O tempo não se perde mais quando o Chrome desliga o service worker (a sessão atual fica em `chrome.storage.session`).
- Navegar para outro site na mesma aba agora separa os tempos.
- Trocar entre duas janelas do Chrome agora salva o tempo da aba anterior.
- Eventos simultâneos não apagam mais a soma um do outro (fila de execução).
- **Segurança:** títulos e domínios são exibidos com `textContent` em vez de `innerHTML`, evitando injeção de HTML (XSS).

### Adicionado
- Tempo do site atual correndo ao vivo no popup, com destaque "● agora".
- Pausa automática ao bloquear a tela ou após 5 minutos de ausência (vídeo tocando continua contando).
- Salvamento automático a cada minuto.
- Porcentagem de cada site no total.
- Testes automatizados (`npm test`).
- Ícones nos tamanhos 16, 32, 48 e 128 px.

### Alterado
- Código organizado em `src/background`, `src/popup` e `src/shared`.
- Fontes incluídas na extensão, em vez de carregadas do Google Fonts.
- Permissão `activeTab` removida (não era usada); adicionadas `idle` e `alarms`.

## 1.0.0
- Primeira versão: tempo por aba, ranking com barras de progresso e botão de zerar.
