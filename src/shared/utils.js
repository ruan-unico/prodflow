// Funções puras usadas pelo service worker e pelo popup.
// "Puras" = não dependem da API do Chrome, então dá para testar com Node.

// Converte segundos em texto legível: 4805 -> "1h 20m 5s"
export function formatarTempo(totalSegundos) {
  const segundos = Math.max(0, Math.floor(totalSegundos));
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = segundos % 60;

  // Acima de 1 hora, os segundos só poluem a leitura
  if (horas > 0) return `${horas}h ${minutos}m`;
  if (minutos > 0) return `${minutos}m ${resto}s`;
  return `${resto}s`;
}

// Extrai o domínio de uma URL: "https://www.youtube.com/watch?v=x" -> "youtube.com"
// Retorna null para páginas que não são sites (chrome://, nova aba, arquivos locais...),
// porque não faz sentido contar tempo nelas.
export function extrairDominio(url) {
  if (!url) return null;

  let endereco;
  try {
    endereco = new URL(url);
  } catch {
    return null;
  }

  if (endereco.protocol !== "http:" && endereco.protocol !== "https:") return null;

  return endereco.hostname.replace(/^www\./, "") || null;
}

// Soma o tempo da sessão que ainda está "correndo" aos tempos já salvos,
// e devolve a lista ordenada do maior para o menor tempo.
export function montarRanking(tempos, sessaoAtual, agora) {
  const totais = { ...tempos };

  if (sessaoAtual?.dominio && sessaoAtual.inicio) {
    const emAndamento = Math.floor((agora - sessaoAtual.inicio) / 1000);
    totais[sessaoAtual.dominio] = (totais[sessaoAtual.dominio] || 0) + Math.max(0, emAndamento);
  }

  return Object.entries(totais)
    .filter(([, segundos]) => segundos > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([dominio, segundos]) => ({ dominio, segundos }));
}
