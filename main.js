'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const print = process._rawDebug;

module.exports = jsondb;


function jsondb(db_path) {
  return new JSONDB(resolvePath(db_path));
}


function JSONDB(db_path) {
  this.path = db_path;
}


JSONDB.prototype.get = function get(key, regex_name) {
  checkKey(key);

  if (!(regex_name instanceof RegExp)) {
    if (regex_name !== undefined)
      throw new TypeError('regex_name must be a RegExp');
    const ret = getSingleEntry(this.path, key);
    return ret === null ? ret : JSON.parse(ret.toString('binary'));
  }

  const ret_obj = getMultiEntry(this.path, key, regex_name);
  for (let i in ret_obj) {
    ret_obj[i] = JSON.parse(ret_obj[i].toString('binary'));
  }
  return ret_obj;
};


JSONDB.prototype.getRaw = function getRaw(key, regex_name) {
  checkKey(key);

  if (!(regex_name instanceof RegExp)) {
    if (regex_name !== undefined)
      throw new TypeError('regex_name must be a RegExp');
    return getSingleEntry(this.path, key);
  }

  return getMultiEntry(this.path, key, regex_name);
};


JSONDB.prototype.set = function set(key, value) {
  checkKey(key);

  if (!Buffer.isBuffer(value)) {
    if (typeof value !== 'string')
      value = Buffer(JSON.stringify(value), 'binary');
    else
      value = Buffer(value, 'binary');
  }

  try {
    fs.writeFileSync(resolvePath(this.path + key + '.json'), value);
  } catch (e) {
    print(e.message);
    return false;
  }
};


JSONDB.prototype.del = function del(key) {
  checkKey(key);

  try {
    fs.unlinkSync(resolvePath(this.path + key + '.json'));
    return true;
  } catch (e) {
    print(e.message);
    return false;
  }
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


function checkKey(key) {
  if (key.charAt(0) !== '/')
    throw new Error('all keys must start with a /');
}


function getSingleEntry(tpath, key) {
  try {
    return fs.readFileSync(resolvePath(tpath + key + '.json'));
  } catch (e) {
    print(e.message);
    return null;
  }
}


function getMultiEntry(tpath, key, regex) {
  const ls = fs.readdirSync(resolvePath(tpath + key));
  const files = {};
  for (let i of ls) {
    if (regex.test(path.basename(i, '.json')) &&
        fs.statSync(tpath + key + '/' + i).isFile()) {
      files[path.basename(i, '.json')] =
          fs.readFileSync(tpath + key + '/' + i);
    }
  }
  return files;
}
