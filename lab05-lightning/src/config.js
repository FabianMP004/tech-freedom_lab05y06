const path = require('node:path');

function loadWalletConfig(environment = process.env) {
  const mnemonic = environment.WDK_MNEMONIC;
  const storageKey = environment.WDK_STORAGE_KEY;
  if (!mnemonic || mnemonic === 'replace-with-runtime-secret') {
    throw new Error('WDK_MNEMONIC must be configured at runtime');
  }
  if (!storageKey || storageKey === 'replace-with-32-byte-secret') {
    throw new Error('WDK_STORAGE_KEY must be configured at runtime');
  }
  return Object.freeze({
    mnemonic,
    storageKey,
    network: environment.WDK_NETWORK || 'testnet',
    rpcUrl: environment.WDK_RPC_URL || '',
    lightningPackage: environment.WDK_LIGHTNING_PACKAGE || '@tetherto/wdk-wallet-spark',
    statePath: environment.WDK_STATE_PATH || path.join(process.cwd(), 'runtime', 'wallet-state.json'),
  });
}

module.exports = { loadWalletConfig };
