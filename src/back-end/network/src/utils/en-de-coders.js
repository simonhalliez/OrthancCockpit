// Adapted from example code provided in the UCLouvain LINFO2145 course project
const jwt = require('jwt-simple')

/**
 * Encodes a JWT token for a user.
 * @param {string} user - The username to encode in the token.
 * @returns {string} The encoded JWT token.
 *
 * The token payload contains:
 *   - exp: Expiration timestamp (14 days from now)
 *   - iat: Issued at timestamp
 *   - sub: The user identifier
 */
function encodeToken (user) {
  var playload = {
    exp: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
    iat: Math.floor(Date.now() / 1000),
    sub: user
  }
  return jwt.encode(playload, process.env.ADMIN_PASSWORD)
}

/**
 * Decodes and verifies a JWT token.
 * @param {string} token - The JWT token to decode.
 * @returns {string} The user identifier (sub) if the token is valid and not expired.
 * @throws {Error} If the token is invalid or expired.
 */
function decodeToken(token) {
  try {
    const decoded = jwt.decode(token, process.env.ADMIN_PASSWORD);

    if (decoded.exp <= Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }

    return decoded.sub;
  } catch (err) {
    throw new Error('Token invalide');
  }
}

module.exports = {
  encodeToken,
  decodeToken
}
