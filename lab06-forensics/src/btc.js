function btcHex(value, name) {
  if (typeof value !== 'string' || !/^(?:0x)?(?:[0-9a-fA-F]{2})*$/.test(value)) {
    throw new TypeError(`${name} must be an even-length hex string`);
  }
  return value.startsWith('0x') ? value.slice(2).toLowerCase() : value.toLowerCase();
}

function isTaprootControlBlock(value) {
  const bytes = value.length / 2;
  if (bytes < 33 || bytes > 129 || (bytes - 33) % 32 !== 0) return false;
  const leafVersion = parseInt(value.slice(0, 2), 16) & 0xfe;
  return leafVersion >= 0xc0 && leafVersion <= 0xfe;
}

export function isTaprootInput(input) {
  return Boolean(
    input
    && input.prevout
    && input.prevout.scriptpubkey_type === 'v1_p2tr'
    && Array.isArray(input.witness)
    && input.witness.length > 0,
  );
}

export function calculateVbytes(transaction) {
  if (!transaction || !Number.isSafeInteger(transaction.weight) || transaction.weight < 0) {
    throw new TypeError('transaction weight must be a non-negative safe integer');
  }
  return Math.ceil(transaction.weight / 4);
}

function leafCouldBeHtlcLike(leafScript) {
  const bytes = leafScript.slice(2);
  return bytes.includes('a8') && (bytes.includes('87') || bytes.includes('88')) && bytes.includes('ac');
}

export function classifyBitcoinTransaction(transaction) {
  if (!transaction || !Array.isArray(transaction.vin)) throw new TypeError('transaction must contain inputs');
  const inputs = transaction.vin.map((input) => {
    const taproot = isTaprootInput(input);
    const witness = taproot ? classifyWitness(input.witness) : null;
    const scriptPath = witness?.spendType === 'script-path' ? extractScriptPathLeaf(input.witness) : null;
    return Object.freeze({
      taproot,
      witness,
      scriptPath,
    });
  });
  const scriptPaths = inputs.filter((input) => input.scriptPath);
  let htlcLike;
  if (scriptPaths.length === 0 && inputs.some((input) => input.witness?.spendType === 'key-path')) {
    htlcLike = {
      status: 'unknown',
      reason: 'key-path witness does not reveal the Taproot script tree or spending conditions',
    };
  } else if (scriptPaths.some((input) => leafCouldBeHtlcLike(input.scriptPath.leafScript))) {
    htlcLike = {
      status: 'refused',
      reason: 'observable leaf script is not sufficient to attribute this spend to a named HTLC or service',
    };
  } else {
    htlcLike = {
      status: 'refused',
      reason: 'public transaction data does not establish a Taproot HTLC-like spending condition',
    };
  }
  return Object.freeze({
    taprootInputCount: inputs.filter((input) => input.taproot).length,
    inputs,
    vbytes: calculateVbytes(transaction),
    htlcLike: Object.freeze(htlcLike),
    hiddenTreeConditions: 'unknown',
  });
}

export function classifyWitness(witness) {
  if (!Array.isArray(witness) || witness.length === 0) throw new TypeError('witness must be a non-empty array');
  const values = witness.map((item) => btcHex(item, 'witness element'));
  return {
    spendType: witness.length === 1 ? 'key-path' : isTaprootControlBlock(values.at(-1)) ? 'script-path' : 'unknown',
    elementCount: witness.length,
  };
}

export function extractScriptPathLeaf(witness) {
  if (!Array.isArray(witness) || witness.length < 2) throw new TypeError('script-path witness must contain a leaf and control block');
  const leafScript = btcHex(witness.at(-2), 'leaf script');
  const controlBlock = btcHex(witness.at(-1), 'control block');
  if (!isTaprootControlBlock(controlBlock)) throw new TypeError('control block has an invalid length or path');
  return {
    leafScript: `0x${leafScript}`,
    controlBlock: `0x${controlBlock}`,
    leafVersion: `0x${(parseInt(controlBlock.slice(0, 2), 16) & 0xfe).toString(16).padStart(2, '0')}`,
  };
}

export function createBitcoinFetcher({ request = fetch, baseUrl = '' } = {}) {
  if (typeof request !== 'function') throw new TypeError('request must be a function');
  return Object.freeze({
    async getTransaction(transactionId) {
      if (typeof transactionId !== 'string' || !/^[0-9a-fA-F]{64}$/.test(transactionId)) {
        throw new TypeError('transaction id must be a 32-byte hex value');
      }
      return request(`${baseUrl}/api/tx/${transactionId}`);
    },
  });
}
