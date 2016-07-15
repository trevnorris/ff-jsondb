'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

module.exports = {
  resolvePath,
};


function resolvePath(pp) {
  if (typeof pp !== 'string') {
    throw new TypeError('path was not supplied');
  }

  if (!path.isAbsolute(pp)) {
    pp = path.resolve(pp);
  }

  const path_dirname = path.dirname(pp);
  try {
    fs.accessSync(path_dirname, fs.R_OK | fs.W_OK);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    mkdirp.sync(path_dirname);
  }

  return fs.realpathSync(path_dirname) + '/' + path.basename(pp);
}
