'use strict';

/**
 * Dependencies
 */
const splitNameEmail = require('./split-name-email');

/**
 * Helper to parse an identity
 */
module.exports = function parseIdentity(identity) {

  //Initialize
  let name, email;

  //Extract name and email if string given
  if (typeof identity === 'string') {
    [name, email] = splitNameEmail(identity);
  }

  //If object, extract
  else if (typeof identity === 'object') {
    ({name, email}) = identity;
  }

  //Must have email
  if (!email) {
    return null;
  }

  //Return as simple identity object
  return {name, email};
};
