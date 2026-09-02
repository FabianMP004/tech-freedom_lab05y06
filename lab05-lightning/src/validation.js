const MAX_MEMO_LENGTH = 280;

class RequestValidationError extends TypeError {
  constructor(message) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

function validationError(message) {
  return new RequestValidationError(message);
}

function assertAllowedKeys(body, allowedKeys) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(body).some((key) => !allowed.has(key))) {
    throw validationError('Request body contains unsupported fields');
  }
}

function validateInvoiceBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('Request body must be a JSON object');
  }
  assertAllowedKeys(body, ['amountSats', 'memo']);
  if (!Number.isSafeInteger(body.amountSats) || body.amountSats < 1) {
    throw validationError('amountSats must be a positive safe integer');
  }
  if (body.memo !== undefined && (typeof body.memo !== 'string' || body.memo.length > MAX_MEMO_LENGTH)) {
    throw validationError(`memo must be a string of at most ${MAX_MEMO_LENGTH} characters`);
  }
  return { amountSats: body.amountSats, ...(body.memo === undefined ? {} : { memo: body.memo }) };
}

function validatePayBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('Request body must be a JSON object');
  }
  assertAllowedKeys(body, ['bolt11']);
  if (typeof body.bolt11 !== 'string' || body.bolt11.trim().length === 0 || body.bolt11.length > 10000) {
    throw validationError('bolt11 must be a non-empty string of at most 10000 characters');
  }
  if (!/^ln(?:bc|tb|bcrt|sb)(?:\d+(?:[munp])?)?1[02-9ac-hj-np-z]+$/i.test(body.bolt11)) {
    throw validationError('bolt11 must be a valid Lightning invoice format');
  }
  return { bolt11: body.bolt11 };
}

function validateInvoiceId(invoiceId) {
  if (typeof invoiceId !== 'string' || invoiceId.length === 0 || invoiceId.length > 256) {
    throw validationError('invoiceId must be a non-empty string of at most 256 characters');
  }
  return invoiceId;
}

module.exports = { MAX_MEMO_LENGTH, RequestValidationError, validateInvoiceBody, validatePayBody, validateInvoiceId };
