// A IA de mentira dos testes da latam-chat: toma o lugar da biblioteca da
// Anthropic (npm:@anthropic-ai/sdk) e devolve o que o teste mandar, sem
// internet e sem gastar nada. O teste escolhe a resposta em
// globalThis.__claudeFalso(params) e lê os pedidos em globalThis.__pedidosClaude.

class APIError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export default class Anthropic {
  constructor(options) {
    this.options = options;
    this.beta = {
      messages: {
        create: async params => {
          // Cópia funda: a função continua mexendo no array depois.
          globalThis.__pedidosClaude.push(JSON.parse(JSON.stringify(params)));
          return globalThis.__claudeFalso(params);
        },
      },
    };
  }
}
Anthropic.APIError = APIError;
