const HEX = /^0x(?:[0-9a-fA-F]{2})*$/;

function hexBytes(value, name = 'hex value') {
  if (typeof value !== 'string' || !HEX.test(value)) {
    throw new TypeError(`${name} must be an even-length 0x-prefixed hex string`);
  }
  return value.slice(2).toLowerCase();
}

function word(data, byteOffset) {
  if (!Number.isSafeInteger(byteOffset) || byteOffset < 0 || byteOffset % 32 !== 0) {
    throw new RangeError('ABI word offset must be aligned and safe');
  }
  const start = byteOffset * 2;
  if (start + 64 > data.length) throw new RangeError('ABI data is truncated');
  return data.slice(start, start + 64);
}

function safeByteNumber(value, name) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError(`${name} exceeds safe integer bounds`);
  return Number(value);
}

function decodeValue(type, data, index, headBytes) {
  const raw = word(data, index * 32);
  if (type === 'address') {
    if (!/^0{24}/.test(raw)) throw new TypeError('address has non-zero padding');
    return `0x${raw.slice(24)}`;
  }
  if (type === 'bool') {
    if (!/^0{63}[01]$/.test(raw)) throw new TypeError('bool must be encoded as 0 or 1');
    return raw.endsWith('1');
  }
  const uint = type.match(/^uint(\d*)$/);
  if (uint) {
    const width = uint[1] === '' ? 256 : Number(uint[1]);
    if (width < 8 || width > 256 || width % 8 !== 0) throw new TypeError('invalid uint width');
    const value = BigInt(`0x${raw}`);
    if (value >= (1n << BigInt(width))) throw new RangeError('uint value exceeds declared width');
    return value;
  }
  const int = type.match(/^int(\d*)$/);
  if (int) {
    const width = int[1] === '' ? 256 : Number(int[1]);
    if (width < 8 || width > 256 || width % 8 !== 0) throw new TypeError('invalid int width');
    const unsigned = BigInt(`0x${raw}`);
    const value = raw[0] >= '8' ? unsigned - (1n << 256n) : unsigned;
    const minimum = -(1n << BigInt(width - 1));
    const maximum = (1n << BigInt(width - 1)) - 1n;
    if (value < minimum || value > maximum) throw new RangeError('int value exceeds declared width');
    return value;
  }
  const bytesN = type.match(/^bytes(\d+)$/);
  if (bytesN) {
    const size = Number(bytesN[1]);
    if (size < 1 || size > 32) throw new TypeError('bytesN width must be between 1 and 32');
    if (!/^0*$/.test(raw.slice(size * 2))) throw new TypeError('bytesN has non-zero padding');
    return `0x${raw.slice(0, size * 2)}`;
  }
  if (type === 'bytes' || type === 'string') {
    const offsetValue = BigInt(`0x${raw}`);
    if (offsetValue % 32n !== 0n) throw new RangeError('ABI dynamic offset must be aligned');
    const offset = safeByteNumber(offsetValue, 'ABI dynamic offset');
    if (offset < headBytes) throw new RangeError('ABI dynamic offset points into the head');
    const lengthValue = BigInt(`0x${word(data, offset)}`);
    const length = safeByteNumber(lengthValue, 'ABI dynamic length');
    const dataBytes = BigInt(data.length / 2);
    const contentStartValue = offsetValue + 32n;
    const paddedLengthValue = ((lengthValue + 31n) / 32n) * 32n;
    if (contentStartValue > dataBytes || paddedLengthValue > dataBytes - contentStartValue) {
      throw new RangeError('ABI dynamic value is out of bounds');
    }
    const contentStart = safeByteNumber(contentStartValue, 'ABI dynamic content offset');
    const paddedLength = safeByteNumber(paddedLengthValue, 'ABI dynamic padded length');
    const contentEnd = contentStart + length;
    const padding = data.slice(contentEnd * 2, (contentStart + paddedLength) * 2);
    if (!/^0*$/.test(padding)) throw new TypeError('ABI dynamic value has non-zero padding');
    const bytes = data.slice(contentStart * 2, contentEnd * 2);
    return type === 'string' ? Buffer.from(bytes, 'hex').toString('utf8') : `0x${bytes}`;
  }
  throw new TypeError(`Unsupported ABI parameter type: ${type}`);
}

export function calldataByteLength(calldata) {
  return hexBytes(calldata, 'calldata').length / 2;
}

export function extractSelector(calldata) {
  const data = hexBytes(calldata, 'calldata');
  if (data.length < 8) throw new RangeError('calldata must contain a four-byte selector');
  return `0x${data.slice(0, 8)}`;
}

export function decodeAbiParameters(types, calldata) {
  if (!Array.isArray(types)) throw new TypeError('ABI types must be an array');
  const data = hexBytes(calldata, 'calldata').slice(8);
  if (data.length % 64 !== 0) throw new RangeError('ABI data must be a whole number of words');
  const headBytes = types.length * 32;
  if (headBytes > data.length / 2) throw new RangeError('ABI data is truncated');
  return types.map((type, index) => decodeValue(type, data, index, headBytes));
}

export function createEthereumFetcher({ request = fetch, baseUrl = '' } = {}) {
  if (typeof request !== 'function') throw new TypeError('request must be a function');
  return Object.freeze({
    async getTransaction(transactionId) {
      if (typeof transactionId !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(transactionId)) {
        throw new TypeError('transaction id must be a 0x-prefixed 32-byte hex value');
      }
      return request(`${baseUrl}/eth/transaction/${transactionId}`);
    },
  });
}

export { hexBytes };
