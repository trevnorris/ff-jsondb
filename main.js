'use strict';

const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const debuglog = require('util').debuglog('jsondb');

module.exports = jsondb;


function jsondb(db_path) {
  return new JSONDB(resolvePath(db_path));
}


function JSONDB(db_path) {
  this.path = db_path;
}


// TODO(trevnorris): Add a .recGet() that uses the regexp to search all files
// in all matching folders and subfolders.
// TODO(trevnorris): Add a callback option that returns entries in groups,
// since there may be too many entries to process all at once.
JSONDB.prototype.get = function get(key, regex_name) {
  checkKey(key);

  if (!(regex_name instanceof RegExp)) {
    if (regex_name !== undefined)
      throw new TypeError('regex_name must be a RegExp');
    const ret = getSingleEntry(this.path, key);
    return ret === null ? ret : JSON.parse(ret.toString());
  }

  const ret_obj = getMultiEntry(this.path, key, regex_name);
  for (let i in ret_obj) {
    ret_obj[i] = JSON.parse(ret_obj[i].toString());
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
      value = Buffer(JSON.stringify(value));
    else
      value = Buffer(value);
  }

  try {
    fs.writeFileSync(resolvePath(this.path + key + '.json'), value);
  } catch (e) {
    debuglog(e.message);
    return false;
  }
};


JSONDB.prototype.del = function del(key) {
  checkKey(key);

  try {
    fs.unlinkSync(resolvePath(this.path + key + '.json'));
    return true;
  } catch (e) {
    debuglog(e.message);
    return false;
  }
};


JSONDB.prototype.exists = function exists(key) {
  checkKey(key);

  try {
    fs.accessSync(resolvePath(this.path + key + '.json'));
    return true;
  } catch (e) {
    debuglog(e.message);
    return false;
  }
};


JSONDB.prototype.listEntries = function listEntries(key, regex) {
  return listAll(key, regex, this.path, 'isFile');
};


JSONDB.prototype.listDirs = function listDirs(key, regex) {
  return listAll(key, regex, this.path, 'isDirectory');
};


JSONDB.prototype.countEntries = function countEntries(key, regex) {
  const rpath = resolvePath(this.path + key);
  let counter = 0;
  let ls;
  try {
    ls = fs.readdirSync(rpath);
  } catch (e) {
    debuglog(e.message);
    return -1;
  }
  for (let file of ls) {
    if (!fs.statSync(rpath + '/' + file).isFile())
      continue;
    file = file.substr(0, file.length - 5);
    if (regex) {
      if (regex.test(file))
        counter++;
    } else {
      counter++;
    }
  }
  return counter;
};


function listAll(key, regex, tpath, fnstr) {
  const entries = [];
  const rpath = resolvePath(tpath + key);
  let ls;
  try {
    ls = fs.readdirSync(rpath);
  } catch (e) {
    debuglog(e.message);
    return null;
  }
  for (let i of ls) {
    if (fs.statSync(rpath + '/' + i)[fnstr]()) {
      const stripped = fnstr === 'isFile' ? stripExt(i) : i;
      if ((regex && regex.test(stripped)) || !regex)
        entries.push(stripped);
    }
  }
  return entries;
}


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
    debuglog(e.message);
    return null;
  }
}


function getMultiEntry(tpath, key, regex) {
  const files = {};
  const rpath = resolvePath(tpath + key);
  let ls;
  try {
    ls = fs.readdirSync(rpath);
  } catch (e) {
    debuglog(e.message);
    return files;
  }
  for (let i of ls) {
    if (regex.test(stripExt(i)) &&
        fs.statSync(rpath + '/' + i).isFile()) {
      files[stripExt(i)] = fs.readFileSync(tpath + key + '/' + i);
    }
  }
  return files;
}


function stripExt(str) {
  return str.substr(0, str.length - 5);
}
