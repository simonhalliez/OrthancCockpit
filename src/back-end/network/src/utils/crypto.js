const crypto = require('crypto');

/**
 * Encrypts a text using AES-256-CBC.
 * @param {string} text - The text to encrypt.
 * @param {string} secret - The secret key used for encryption.
 * @returns {string} The encrypted text in the format iv:encrypted.
 */
function encrypt(text, secret) {
  const iv = crypto.randomBytes(16);
  const key = crypto.createHash('sha256').update(secret).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts a text encrypted with the encrypt function.
 * @param {string} encrypted - The encrypted text in the format iv:encrypted.
 * @param {string} secret - The secret key used for decryption.
 * @returns {string} The decrypted text.
 */
function decrypt(encrypted, secret) {
  const [ivHex, encryptedText] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = crypto.createHash('sha256').update(secret).digest();
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Creates a user ID hash from username, password, and secret.
 * @param {string} username - The username.
 * @param {string} password - The password.
 * @param {string} secret - The secret key.
 * @returns {string} The SHA-256 hash as user ID.
 */
function createUserId(username, password, secret) {
  return crypto.createHash('sha256').update(username + password + secret).digest('hex');
}

module.exports = {
  encrypt,
  decrypt,
  createUserId
};