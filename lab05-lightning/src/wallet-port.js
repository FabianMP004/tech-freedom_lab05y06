function createWalletPort(wallet) {
  if (!wallet || typeof wallet !== 'object') throw new TypeError('Lightning wallet adapter is required');
  for (const method of ['createInvoice', 'checkInvoice', 'payInvoice']) {
    if (typeof wallet[method] !== 'function') throw new TypeError(`Lightning wallet adapter must implement ${method}`);
  }
  return Object.freeze({
    ...(wallet.state ? { state: wallet.state } : {}),
    ...(wallet.identityKey ? { identityKey: wallet.identityKey } : {}),
    ...(wallet.nodeId ? { nodeId: wallet.nodeId } : {}),
    createInvoice: wallet.createInvoice.bind(wallet),
    checkInvoice: wallet.checkInvoice.bind(wallet),
    payInvoice: wallet.payInvoice.bind(wallet),
  });
}

const SPARK_PACKAGE = '@tetherto/wdk-wallet-spark';

function mapSparkNetwork(network) {
  const normalized = String(network || 'mainnet').toUpperCase();
  if (!['MAINNET', 'TESTNET', 'REGTEST'].includes(normalized)) {
    throw new TypeError('WDK_NETWORK must be mainnet, testnet, or regtest for Spark');
  }
  return normalized;
}

function isSettledSparkStatus(status) {
  return ['COMPLETED', 'PAID', 'SETTLED', 'LIGHTNING_PAYMENT_RECEIVED', 'TRANSFER_COMPLETED']
    .includes(String(status || '').toUpperCase());
}

async function getPublicSparkMetadata(account) {
  const metadata = {};
  if (typeof account.getIdentityKey === 'function') {
    const identityKey = await account.getIdentityKey();
    if (typeof identityKey === 'string' && identityKey.length > 0) metadata.identityKey = identityKey;
  }
  if (typeof account.getNodeId === 'function') {
    const nodeId = await account.getNodeId();
    if (typeof nodeId === 'string' && nodeId.length > 0) metadata.nodeId = nodeId;
  } else if (typeof account.nodeId === 'string' && account.nodeId.length > 0) {
    metadata.nodeId = account.nodeId;
  }
  return metadata;
}

async function createSparkWalletFactory(config, loadPackage) {
  let loaded;
  try {
    loaded = await loadPackage(SPARK_PACKAGE);
  } catch (error) {
    throwUnavailableLightningAdapter('the configured WDK Lightning package could not be loaded');
  }
  const WalletManagerSpark = loaded && loaded.default;
  if (typeof WalletManagerSpark !== 'function') {
    throwUnavailableLightningAdapter('the configured WDK Lightning package does not export its default WalletManagerSpark');
  }
  return async () => {
    const manager = new WalletManagerSpark(config.mnemonic, {
      network: mapSparkNetwork(config.network),
    });
    const account = await manager.getAccount(0);
    const metadata = await getPublicSparkMetadata(account);
    return createWalletPort({
      ...metadata,
      async createInvoice(input) {
        const result = await account.createLightningInvoice({
          amountSats: input.amountSats,
          memo: input.memo,
        });
        return {
          invoiceId: result.id,
          bolt11: result.invoice,
          amountSats: input.amountSats,
          memo: input.memo,
        };
      },
      async checkInvoice(invoiceId) {
        const result = await account.getLightningReceiveRequest(invoiceId);
        return {
          invoiceId,
          settled: Boolean(result && isSettledSparkStatus(result.status)),
        };
      },
      async payInvoice(bolt11) {
        await account.payLightningInvoice({ encodedInvoice: bolt11 });
        return { bolt11, paid: true };
      },
    });
  };
}

function createUnavailableLightningWalletFactory(reason = 'no Lightning adapter module is configured') {
  return async function unavailableLightningWalletFactory() {
    throw new Error(`Lightning adapter unavailable: ${reason}`);
  };
}

function throwUnavailableLightningAdapter(reason) {
  throw new Error(`Lightning adapter unavailable: ${reason}`);
}

/**
 * Custom WDK Lightning packages must export:
 * createLightningWallet({ mnemonic, network, rpcUrl, state }) => wallet
 * where wallet implements createInvoice, checkInvoice, and payInvoice.
 * Spark uses its ESM default WalletManagerSpark export above.
 */
function createConfiguredWalletFactory(config, { loadPackage = require } = {}) {
  if (!config.lightningPackage) {
    throwUnavailableLightningAdapter('no WDK Lightning package is configured');
  }
  if (config.lightningPackage === SPARK_PACKAGE) {
    const loadSparkPackage = loadPackage === require ? (packageName) => import(packageName) : loadPackage;
    return async ({ state } = {}) => {
      const factory = await createSparkWalletFactory(config, loadSparkPackage);
      return factory({ state });
    };
  }
  let loaded;
  try {
    loaded = loadPackage(config.lightningPackage);
  } catch (error) {
    throwUnavailableLightningAdapter('the configured WDK Lightning package could not be loaded');
  }
  const createAdapterWallet = loaded && loaded.createLightningWallet;
  if (typeof createAdapterWallet !== 'function') {
    throwUnavailableLightningAdapter('the configured WDK Lightning package does not export createLightningWallet');
  }
  return async ({ state }) => createWalletPort(await createAdapterWallet({
    mnemonic: config.mnemonic,
    network: config.network,
    rpcUrl: config.rpcUrl,
    state,
  }));
}

module.exports = {
  createWalletPort,
  createConfiguredWalletFactory,
  createProductionWalletFactory: createConfiguredWalletFactory,
  createUnavailableLightningWalletFactory,
};
