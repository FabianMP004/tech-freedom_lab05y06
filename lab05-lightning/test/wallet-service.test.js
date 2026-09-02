const test = require('node:test');
const assert = require('node:assert/strict');

const { createWalletService } = require('../src/wallet-service');
const {
  createProductionWalletFactory,
  createUnavailableLightningWalletFactory,
} = require('../src/wallet-port');

function fakeWallet() {
  return {
    async createInvoice(input) {
      return { invoiceId: 'inv-test-1', bolt11: 'ln-test-1', ...input };
    },
    async checkInvoice(invoiceId) {
      return { invoiceId, settled: false };
    },
    async payInvoice(bolt11) {
      return { bolt11, paid: true };
    },
  };
}

test('initializes the wallet once and reuses it for subsequent requests', async () => {
  let initializationCount = 0;
  const persistedState = { walletId: 'test-wallet' };
  const store = {
    async read() { return persistedState; },
    async write() { throw new Error('write should not be needed'); },
  };
  const wallet = fakeWallet();
  const service = createWalletService({
    store,
    walletFactory: async ({ state }) => {
      initializationCount += 1;
      assert.deepEqual(state, persistedState);
      return wallet;
    },
  });

  const [first, second] = await Promise.all([
    service.createInvoice({ amountSats: 12, memo: 'first' }),
    service.checkInvoice('inv-test-1'),
  ]);
  const payment = await service.payInvoice('ln-test-1');

  assert.equal(first.invoiceId, 'inv-test-1');
  assert.equal(second.settled, false);
  assert.equal(payment.paid, true);
  assert.equal(initializationCount, 1);
});

test('persists wallet state returned during initialization without mnemonic fields', async () => {
  let saved;
  const service = createWalletService({
    store: {
      async read() { return null; },
      async write(state) { saved = state; },
    },
    walletFactory: async () => ({
      state: { walletId: 'new-wallet', mnemonic: 'do-not-save' },
      createInvoice: async () => ({ invoiceId: 'inv-test-2' }),
      checkInvoice: async () => ({ settled: true }),
      payInvoice: async () => ({ paid: true }),
    }),
  });

  await service.checkInvoice('inv-test-2');
  assert.deepEqual(saved, { walletId: 'new-wallet' });
});

test('rejects invalid invoice inputs before initializing or calling the adapter', async () => {
  let initializationCount = 0;
  let adapterCallCount = 0;
  const service = createWalletService({
    store: { async read() { return null; }, async write() {} },
    walletFactory: async () => {
      initializationCount += 1;
      return {
        createInvoice: async () => { adapterCallCount += 1; },
        checkInvoice: async () => { adapterCallCount += 1; },
        payInvoice: async () => { adapterCallCount += 1; },
      };
    },
  });

  await assert.rejects(service.createInvoice({ amountSats: 0 }), /amountSats/i);
  await assert.rejects(service.createInvoice({ amountSats: 1.5 }), /amountSats/i);
  await assert.rejects(service.checkInvoice(''), /invoiceId/i);
  await assert.rejects(service.payInvoice('   '), /bolt11/i);
  assert.equal(initializationCount, 0);
  assert.equal(adapterCallCount, 0);
});

test('loads a WDK Lightning package through its documented factory export', async () => {
  const calls = [];
  const factory = createProductionWalletFactory({
    lightningPackage: 'package-name-from-runtime-config',
    mnemonic: 'runtime-only',
    network: 'testnet',
    rpcUrl: 'http://127.0.0.1:1',
  }, {
    loadPackage: (packageName) => ({
      createLightningWallet: async (options) => {
        calls.push({ packageName, options });
        return fakeWallet();
      },
    }),
  });

  const wallet = await factory({ state: { walletId: 'saved' } });
  await wallet.checkInvoice('inv-test-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].packageName, 'package-name-from-runtime-config');
  assert.deepEqual(calls[0].options, {
    mnemonic: 'runtime-only',
    network: 'testnet',
    rpcUrl: 'http://127.0.0.1:1',
    state: { walletId: 'saved' },
  });
});

test('reports a clear startup error when the configured WDK Lightning package is absent', async () => {
  assert.throws(
    () => createProductionWalletFactory({ lightningPackage: '' }),
    /Lightning adapter unavailable.*package/i,
  );
  assert.equal(typeof createUnavailableLightningWalletFactory, 'function');
});

test('reports a clear startup error when the package lacks the documented factory export', () => {
  assert.throws(
    () => createProductionWalletFactory({ lightningPackage: 'package-name-from-runtime-config' }, {
      loadPackage: () => ({ createWallet: async () => fakeWallet() }),
    }),
    /Lightning adapter unavailable.*createLightningWallet/i,
  );
});

test('constructs the Spark wallet and maps its Lightning API', async () => {
  const calls = [];
  const account = {
    async createLightningInvoice(input) {
      calls.push(['create', input]);
      return { id: 'spark-invoice-1', invoice: 'ln-spark-1' };
    },
    async getLightningReceiveRequest(invoiceId) {
      calls.push(['check', invoiceId]);
      return { id: invoiceId, status: 'TRANSFER_COMPLETED' };
    },
    async payLightningInvoice(input) {
      calls.push(['pay', input]);
      return { id: 'spark-payment-1' };
    },
    async getIdentityKey() {
      return '02public-identity-key';
    },
  };
  class WalletManagerSpark {
    constructor(mnemonic, options) {
      calls.push(['construct', mnemonic, options]);
    }

    async getAccount(index) {
      calls.push(['account', index]);
      return account;
    }
  }

  const factory = createProductionWalletFactory({
    lightningPackage: '@tetherto/wdk-wallet-spark',
    mnemonic: 'test-only-placeholder-mnemonic',
    network: 'testnet',
    rpcUrl: 'ignored',
  }, {
    loadPackage: async () => ({ default: WalletManagerSpark }),
  });

  const wallet = await factory({ state: { walletId: 'saved' } });
  assert.equal(wallet.identityKey, '02public-identity-key');
  assert.deepEqual(await wallet.createInvoice({ amountSats: 21, memo: 'test' }), {
    invoiceId: 'spark-invoice-1',
    bolt11: 'ln-spark-1',
    amountSats: 21,
    memo: 'test',
  });
  assert.deepEqual(await wallet.checkInvoice('spark-invoice-1'), {
    invoiceId: 'spark-invoice-1',
    settled: true,
  });
  assert.deepEqual(await wallet.payInvoice('ln-spark-pay-1'), {
    bolt11: 'ln-spark-pay-1',
    paid: true,
  });
  assert.deepEqual(calls, [
    ['construct', 'test-only-placeholder-mnemonic', { network: 'TESTNET' }],
    ['account', 0],
    ['create', { amountSats: 21, memo: 'test' }],
    ['check', 'spark-invoice-1'],
    ['pay', { encodedInvoice: 'ln-spark-pay-1' }],
  ]);
});

test('maps unsettled and missing Spark receive requests safely', async () => {
  const account = {
    async getLightningReceiveRequest(invoiceId) {
      return invoiceId === 'missing' ? null : { id: invoiceId, status: 'INVOICE_CREATED' };
    },
  };
  const factory = createProductionWalletFactory({
    lightningPackage: '@tetherto/wdk-wallet-spark',
    mnemonic: 'test-only-placeholder-mnemonic',
    network: 'regtest',
  }, {
    loadPackage: async () => ({
      default: class {
        async getAccount() { return account; }
      },
    }),
  });
  const wallet = await factory({});
  assert.deepEqual(await wallet.checkInvoice('pending'), { invoiceId: 'pending', settled: false });
  assert.deepEqual(await wallet.checkInvoice('missing'), { invoiceId: 'missing', settled: false });
});

test('does not expose private key material from Spark account metadata', async () => {
  const factory = createProductionWalletFactory({
    lightningPackage: '@tetherto/wdk-wallet-spark',
    mnemonic: 'test-only-placeholder-mnemonic',
    network: 'mainnet',
  }, {
    loadPackage: async () => ({
      default: class {
        async getAccount() {
          return {
            keyPair: { publicKey: '02public', privateKey: 'private-must-not-leak' },
            async getIdentityKey() { return '02public'; },
          };
        }
      },
    }),
  });
  const wallet = await factory({});
  assert.equal(wallet.identityKey, '02public');
  assert.equal('privateKey' in wallet, false);
  assert.equal('keyPair' in wallet, false);
});
