'use strict';

const fs = require('fs');
const debuglog = require('util').debuglog('jsondb');
const DBIndex = require('./db-index');
const resolvePath = require('./util').resolvePath;

module.exports = jsondb;


function jsondb(db_path) {
  return new JSONDB(resolvePath(db_path));
}


function JSONDB(db_path, index_path) {
  this.path = db_path;
  this.index = new DBIndex(this, index_path);
}


// TODO(trevnorris): Add a .recGet() that uses the regexp to search all
// files in all matching folders and subfolders. (the "rec" in recGet()
// stands for "recursive");
JSONDB.prototype.get = function get(key, regex_name, callback) {
  checkKey(key);

  if (!(regex_name instanceof RegExp)) {
    if (regex_name !== undefined)
      throw new TypeError('regex_name must be a RegExp');
    const ret = getSingleEntry(this.path, key);
    return ret === null ? ret : JSON.parse(ret);
  }

  if (typeof callback === 'function' && !(regex_name instanceof RegExp)) {
    throw new TypeError('callback requires a valid regex');
  }

  if (typeof callback !== 'function') {
    const ret_obj = getMultiEntry(this, key, regex_name);
    for (let i in ret_obj) {
      ret_obj[i] = JSON.parse(ret_obj[i].toString());
    }
    return ret_obj;
  }

  const list = listAll(key, regex_name, this, 'isFile');
  for (let i of list) {
    const data = getSingleEntry(this.path, key + '/' + i);
    const ret_check =
        callback.call(this, i, data === null ? data : JSON.parse(data));
    // If the user returned "true" then it means operations should stop.
    if (ret_check === true)
      return;
  }
};


JSONDB.prototype.getRaw = function getRaw(key, regex_name, callback) {
  checkKey(key);

  if (!(regex_name instanceof RegExp)) {
    if (regex_name !== undefined)
      throw new TypeError('regex_name must be a RegExp');
    return getSingleEntry(this.path, key);
  }

  if (typeof callback === 'function' && !(regex_name instanceof RegExp)) {
    throw new TypeError('callback requires a valid regex');
  }

  if (typeof callback !== 'function') {
    return getMultiEntry(this, key, regex_name);
  }

  const list = listAll(key, regex_name, this, 'isFile');
  for (let i of list) {
    const ret_check =
        callback.call(this, i, getSingleEntry(this.path, key + '/' + i));
    // If the user returned "true" then it means operations should stop.
    if (ret_check === true)
      return;
  }
};


JSONDB.prototype.set = function set(key, value) {
  checkKey(key);

  // Allow value to be indexed.
  this.index._process(key, value);

  // Convert to Buffer
  if (!Buffer.isBuffer(value)) {
    if (typeof value !== 'string')
      value = Buffer(JSON.stringify(value));
    else
      value = Buffer(value);
  }

  // Write value to disk.
  try {
    fs.writeFileSync(resolvePath(this.path + key + '.json'), value);
  } catch (e) {
    debuglog(e.message);
    return false;
  }
};


JSONDB.prototype.del = function del(key) {
  checkKey(key);

  // XXX: Indexing should do something about this. Was thinking about
  // keeping a list of all index entries listed on a specific key, and when
  // that key is deleted then also remove those keys.

  try {
    fs.unlinkSync(resolvePath(this.path + key + '.json'));
    return true;
  } catch (e) {
    debuglog(e.message);
    return false;
  }
};


// XXX: Recursively delete all files/folders at given key. (what should be
// done if the key is a file and a folder).
JSONDB.prototype.rm_rf = function rm_rf(key) {
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
  return listAll(key, regex, this, 'isFile');
};


JSONDB.prototype.listDirs = function listDirs(key, regex) {
  return listAll(key, regex, this, 'isDirectory');
};


JSONDB.prototype.countEntries = function countEntries(key, regex) {
  const rpath = resolvePath(this.path + key);

  if (rpath === this.index.path)
    throw new Error('attempting to access the db index');

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


function listAll(key, regex, db, fnstr) {
  const entries = [];
  const rpath = resolvePath(db.path + key);
  let ls;

  if (rpath === db.index.path)
    throw new Error('attempting to access the db index');

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


function checkKey(key) {
  if (key.charAt(0) !== '/')
    throw new Error('all keys must start with a "/"');
}


function getSingleEntry(tpath, key) {
  try {
    return fs.readFileSync(resolvePath(tpath + key + '.json'));
  } catch (e) {
    debuglog(e.message);
    return null;
  }
}


function getMultiEntry(db, key, regex) {
  const files = {};
  const rpath = resolvePath(db.path + key);
  let ls;

  if (rpath === db.index.path)
    throw new Error('attempting to access the db index');

  try {
    ls = fs.readdirSync(rpath);
  } catch (e) {
    debuglog(e.message);
    return files;
  }
  for (let i of ls) {
    if (regex.test(stripExt(i)) &&
        fs.statSync(rpath + '/' + i).isFile()) {
      files[stripExt(i)] = fs.readFileSync(db.path + key + '/' + i);
    }
  }
  return files;
}


function stripExt(str) {
  return str.substr(0, str.length - 5);
}
