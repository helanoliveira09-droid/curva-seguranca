// js/api.js
// Camada única de comunicação com o backend. Sem login: todas as rotas
// são abertas — o painel administrativo e o de consulta usam exatamente
// a mesma API, o que garante que os dois estejam sempre sincronizados
// (a "comunicação entre os dois" é o próprio backend + MongoDB compartilhados).

const API_BASE = window.__API_BASE__ || '/api';

async function apiRequest(path, options = {}) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {}
  );

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (networkErr) {
    throw new Error(
      `Não foi possível conectar ao backend em "${API_BASE}". Verifique se o servidor Node/Express (com MongoDB) está rodando.`
    );
  }

  if (res.status === 405) {
    throw new Error(
      `Erro 405 (Método não permitido) em "${API_BASE}${path}". O host provavelmente está servindo apenas arquivos estáticos, sem o backend Node rodando de verdade.`
    );
  }
  if (res.status === 404) {
    throw new Error(`Erro 404: a rota "${path}" não foi encontrada na API.`);
  }

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    try { data = await res.json(); } catch (e) { /* corpo vazio ou inválido */ }
  }

  if (!res.ok) {
    const msg = (data && data.erro)
      || (!contentType.includes('application/json')
            ? `Resposta inesperada do servidor (${res.status}). O host pode não estar executando o backend Node.`
            : `Erro na requisição (${res.status})`);
    throw new Error(msg);
  }
  return data;
}

const Api = {
  health: () => apiRequest('/health'),

  // curva geral (sem setor) ou por setor (passando o nome do setor)
  curva: (dias = 180, setor = null) =>
    apiRequest(`/curva?dias=${dias}${setor ? '&setor=' + encodeURIComponent(setor) : ''}`),
  resumo: (setor = null) =>
    apiRequest(`/curva/resumo${setor ? '?setor=' + encodeURIComponent(setor) : ''}`),
  resumoSetores: () => apiRequest('/curva/setores-resumo'),

  eventos: (filtros = {}) => {
    const qs = new URLSearchParams(filtros).toString();
    return apiRequest(`/eventos${qs ? '?' + qs : ''}`);
  },
  criarEvento: (payload) => apiRequest('/eventos', { method: 'POST', body: JSON.stringify(payload) }),
  removerEvento: (id) => apiRequest(`/eventos/${id}`, { method: 'DELETE' }),

  setores: () => apiRequest('/setores'),
  criarSetor: (payload) => apiRequest('/setores', { method: 'POST', body: JSON.stringify(payload) }),
  removerSetor: (id) => apiRequest(`/setores/${id}`, { method: 'DELETE' }),

  config: () => apiRequest('/config'),
  salvarConfig: (payload) => apiRequest('/config', { method: 'PUT', body: JSON.stringify(payload) })
};
