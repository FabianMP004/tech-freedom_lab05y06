const { loadWalletConfig } = require('./config');
const { createSecureStore } = require('./secure-store');
const { createConfiguredWalletFactory, createWalletPort } = require('./wallet-port');

function sanitizeState(value) {
  if (Array.isArray(value)) return value.map(sanitizeState);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/(mnemonic|private.?key|seed|secret|token)/i.test(key))
    .map(([key, child]) => [key, sanitizeState(child)]));
}

function validateAmountSats(amountSats) {
  if (!Number.isSafeInteger(amountSats) || amountSats < 1) {
    throw new TypeError('amountSats must be a positive safe integer');
  }
}

function validateInvoiceId(invoiceId) {
  if (typeof invoiceId !== 'string' || invoiceId.trim().length === 0 || invoiceId.length > 256) {
    throw new TypeError('invoiceId must be a non-empty string of at most 256 characters');
  }
}

function validateBolt11(bolt11) {
  if (typeof bolt11 !== 'string' || bolt11.trim().length === 0 || bolt11.length > 10000) {
    throw new TypeError('bolt11 must be a non-empty string of at most 10000 characters');
  }
}

function createWalletService({ walletFactory, store, config = null }) {
  if (typeof walletFactory !== 'function') throw new TypeError('walletFactory is required');
  if (!store || typeof store.read !== 'function' || typeof store.write !== 'function') {
    throw new TypeError('store with read and write methods is required');
  }
  let walletPromise;
  const getWallet = () => {
    if (!walletPromise) {
      walletPromise = (async () => {
        const state = await store.read();
        const wallet = createWalletPort(await walletFactory({ state, config }));
        if (!state && wallet.state) await store.write(sanitizeState(wallet.state));
        return wallet;
      })();
    }
    return walletPromise;
  };
  return Object.freeze({
    createInvoice: async (input) => {
      validateAmountSats(input && input.amountSats);
      return (await getWallet()).createInvoice(input);
    },
    checkInvoice: async (invoiceId) => {
      validateInvoiceId(invoiceId);
      return (await getWallet()).checkInvoice(invoiceId);
    },
    payInvoice: async (bolt11) => {
      validateBolt11(bolt11);
      return (await getWallet()).payInvoice(bolt11);
    },
  });
}

let processService;
function getProcessWalletService() {
  if (!processService) {
    const config = loadWalletConfig();
    processService = createWalletService({
      config,
      store: createSecureStore(config.statePath, config.storageKey),
      walletFactory: createConfiguredWalletFactory(config),
    });
  }
  return processService;
}

async function createInvoice(input) { return getProcessWalletService().createInvoice(input); }
async function checkInvoice(invoiceId) { return getProcessWalletService().checkInvoice(invoiceId); }
async function payInvoice(bolt11) { return getProcessWalletService().payInvoice(bolt11); }

module.exports = {
  createWalletService,
  getProcessWalletService,
  createInvoice,
  checkInvoice,
  payInvoice,
  sanitizeState,
  validateAmountSats,
  validateInvoiceId,
  validateBolt11,
};
