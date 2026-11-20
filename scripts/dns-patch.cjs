/**
 * Sandbox helper only — this file is not part of the game bundle.
 *
 * The build container has no /etc/hosts, so Node cannot resolve "localhost".
 * Vite/Vitest probe it during startup, so we answer that one name in-process.
 */
const dns = require('dns');

const origLookup = dns.lookup.bind(dns);
const origPromisesLookup = dns.promises.lookup.bind(dns.promises);

dns.lookup = function patchedLookup(hostname, options, callback) {
  let opts = options;
  let cb = callback;
  if (typeof opts === 'function') {
    cb = opts;
    opts = {};
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (opts && opts.all) return cb(null, [{ address: '127.0.0.1', family: 4 }]);
    return cb(null, '127.0.0.1', 4);
  }
  return origLookup(hostname, opts, cb);
};

dns.promises.lookup = async function patchedPromisesLookup(hostname, options) {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    if (options && options.all) return [{ address: '127.0.0.1', family: 4 }];
    return { address: '127.0.0.1', family: 4 };
  }
  return origPromisesLookup(hostname, options);
};
