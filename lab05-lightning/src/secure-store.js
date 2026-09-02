const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

function parseKey(key) {
  if (Buffer.isBuffer(key) || key instanceof Uint8Array) {
    const bytes = Buffer.from(key);
    if (bytes.length === 32) return bytes;
  }
  if (typeof key === 'string' && /^[0-9a-f]{64}$/i.test(key)) {
    return Buffer.from(key, 'hex');
  }
  if (typeof key === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(key)) {
    const bytes = Buffer.from(key, 'base64');
    if (bytes.length === 32 && bytes.toString('base64') === key) return bytes;
  }
  throw new TypeError('Encryption key must be exactly a 32-byte key as hex or base64');
}

function createSecureStore(filePath, key) {
  if (typeof filePath !== 'string' || !filePath) throw new TypeError('Store path is required');
  const encryptionKey = parseKey(key);

  async function read() {
    let serialized;
    try {
      serialized = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
    try {
      const envelope = JSON.parse(serialized);
      if (envelope.version !== 1) throw new Error('unsupported version');
      const nonce = Buffer.from(envelope.nonce, 'base64');
      const tag = Buffer.from(envelope.tag, 'base64');
      const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, nonce);
      decipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
    } catch (error) {
      throw new Error('Unable to decrypt wallet state', { cause: error });
    }
  }

  async function write(state) {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, nonce);
    const plaintext = Buffer.from(JSON.stringify(state), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const envelope = JSON.stringify({
      version: 1,
      nonce: nonce.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    });
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    try {
      await fs.writeFile(temporaryPath, envelope, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      await fs.rename(temporaryPath, filePath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true });
      throw error;
    }
  }

  return Object.freeze({ read, write });
}

module.exports = { createSecureStore, parseKey };
