// Adapted from example code provided in the UCLouvain LINFO2145 course project
const moment = require('moment')
const jwt = require('jwt-simple')

function encodeToken (user) {
  var playload = {
    exp: moment().add(14, 'days').unix(),
    iat: moment().unix(),
    sub: user
  }
  return jwt.encode(playload, process.env.ADMIN_PASSWORD)
}

function decodeToken(token) {
  try {
    const decoded = jwt.decode(token, process.env.ADMIN_PASSWORD);

    if (decoded.exp <= moment().unix()) {
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
