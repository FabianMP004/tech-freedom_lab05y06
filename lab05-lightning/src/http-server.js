const http = require('node:http');
const { getProcessWalletService } = require('./wallet-service');
const { RequestValidationError, validateInvoiceBody, validatePayBody, validateInvoiceId } = require('./validation');

const MAX_BODY_BYTES = 1024 * 1024;

function publicInvoice(value) {
  return {
    invoiceId: value && value.invoiceId,
    bolt11: value && value.bolt11,
    ...(value && value.amountSats !== undefined ? { amountSats: value.amountSats } : {}),
    ...(value && value.memo !== undefined ? { memo: value.memo } : {}),
  };
}

function publicPayment(value) {
  return {
    bolt11: value && value.bolt11,
    paid: Boolean(value && value.paid),
  };
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > MAX_BODY_BYTES) {
        reject(new RequestValidationError('Request body is too large'));
        request.destroy();
        return;
      }
      body += chunk;
    });
    request.on('end', () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new RequestValidationError('Request body must be valid JSON')); }
    });
    request.on('error', reject);
  });
}

function checkRoute(urlPath) {
  const match = /^\/api\/check\/([^/]+)$/.exec(urlPath);
  return match ? match[1] : null;
}

function isAuthorized(request) {
  const configuredToken = process.env.PAY_AUTH_TOKEN;
  const authorization = request.headers && request.headers.authorization;
  return Boolean(configuredToken && authorization === `Bearer ${configuredToken}`);
}

function isNotFoundError(error) {
  return error && (error.code === 'NOT_FOUND' || /not found|unknown invoice/i.test(error.message || ''));
}

function createRequestHandler({ walletService = getProcessWalletService() } = {}) {
  return async function requestHandler(request, response) {
    const url = new URL(request.url || '/', 'http://localhost');
    try {
      if (request.method === 'POST' && url.pathname === '/api/invoice') {
        const result = await walletService.createInvoice(validateInvoiceBody(await readJson(request)));
        return sendJson(response, 201, { ok: true, data: publicInvoice(result) });
      }
      const rawInvoiceId = request.method === 'GET' ? checkRoute(url.pathname) : null;
      if (rawInvoiceId !== null) {
        const invoiceId = validateInvoiceId(decodeURIComponent(rawInvoiceId));
        if (invoiceId.includes('/') || invoiceId.includes('\\')) {
          throw new RequestValidationError('invoiceId must be a single path segment');
        }
        const result = await walletService.checkInvoice(invoiceId);
        if (!result) return sendJson(response, 404, { ok: false, error: 'Invoice not found' });
        return sendJson(response, 200, { ok: true, data: { settled: Boolean(result && result.settled), invoiceId } });
      }
      if (request.method === 'POST' && url.pathname === '/api/pay') {
        if (!isAuthorized(request)) return sendJson(response, 401, { ok: false, error: 'Unauthorized' });
        const result = await walletService.payInvoice(validatePayBody(await readJson(request)).bolt11);
        return sendJson(response, 200, { ok: true, data: publicPayment(result) });
      }
      return sendJson(response, 404, { ok: false, error: 'Not found' });
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return sendJson(response, 400, { ok: false, error: error.message });
      }
      if (error instanceof URIError || error instanceof SyntaxError) {
        return sendJson(response, 400, { ok: false, error: 'Invalid request' });
      }
      if (request.method === 'GET' && checkRoute(url.pathname) !== null && isNotFoundError(error)) {
        return sendJson(response, 404, { ok: false, error: 'Invoice not found' });
      }
      return sendJson(response, 502, { ok: false, error: 'Wallet service unavailable' });
    }
  };
}

function createHttpServer(options) {
  return http.createServer(createRequestHandler(options));
}

module.exports = { createHttpServer, createRequestHandler, publicInvoice, publicPayment };
