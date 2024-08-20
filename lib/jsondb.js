'use strict';

const fs = require('fs');
const path = require('path');
const debuglog = require('util').debuglog('jsondb');
const DBIndex = require('./db-index');
const resolvePath = require('./util').resolvePath;

module.exports = jsondb;

// Work around an API change in v6
if (!fs.constants) {
  fs.constants = {
    R_OK: fs.R_OK,
    W_OK: fs.W_OK,
  };
}


function jsondb(db_path) {
  return new JSONDB(resolvePath(db_path));
}


function JSONDB(db_path, index_path) {
  this.path = db_path;
  this.index = new DBIndex(this, index_path);
}


JSONDB.prototype.get = function get(key, regex_name, callback) {
  checkKey(this, key);

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


JSONDB.prototype.recGet = function recGet(key, regex) {
  checkKey(this, key);

  if (!(regex instanceof RegExp)) {
    throw new TypeError('regex must be a RegExp');
  }

  const results = [];

  // Helper function to recursively search directories
  function searchDir(currentPath) {
    const entries = fs.readdirSync(currentPath);
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // If it's a directory, recurse into it
        searchDir(fullPath);
      } else if (stat.isFile() && regex.test(entry)) {
        // If it's a file and matches the regex, add to results
        results.push(fullPath);
      }
    }
  }

  // Start the search from the specified key path
  const startPath = resolvePath(this.path + key);
  searchDir(startPath);

  return results;
};


JSONDB.prototype.getRaw = function getRaw(key, regex_name, callback) {
  checkKey(this, key);

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
  checkKey(this, key);

  // Allow value to be indexed.
  this.index._process(key, value);

  // Convert to Buffer
  if (!Buffer.isBuffer(value)) {
    if (typeof value !== 'string')
      value = Buffer.from(JSON.stringify(value));
    else
      value = Buffer.from(value);
  }

  // Write value to disk.
  try {
    fs.writeFileSync(resolvePath(this.path + key + '.json'), value);
  } catch (e) {
    debuglog(e.message);
    return false;
  }
};


// XXX: Should indexing do something about this?
JSONDB.prototype.del = function del(key) {
  checkKey(this, key);

  try {
    fs.unlinkSync(resolvePath(this.path + key + '.json'));
    return true;
  } catch (e) {
    debuglog(e.message);
    return false;
  }
};


// Recursively delete all files/folders at given key. If the key is both a
// file and a folder, only the folder is deleted.
JSONDB.prototype.rm_rf = function rm_rf(key) {
  let cntr = 0;
  let err, key_path;
  do {
    try {
      fs.accessSync(this.path + '/' + key, fs.constants.W_OK)
    } catch (err) {
      return { key, err };  // If can't access, then nothing to be done.
    }
    if (key_path === this.index.disk_path)
      throw new Error('cannot delete path of index: ' + key_path);
    err = rm_rf_all(fs.realpathSync(this.path + '/' + key), this);
  } while (err && ++cntr < 100);
  return err;
};


function rm_rf_all(dir, db) {
  const ls = (() => {
    try { return fs.readdirSync(dir) } catch (err) { return { path: dir, err }};
  })();
  if (!Array.isArray(ls)) return ls;
  for (let i = 0; i < ls.length; i++) {
    const file_path = fs.realpathSync(dir + '/' + ls[i]);
    if (file_path === db.index.disk_path) {
      throw new Error('cannot delete path of index: ' + file_path);
    }

    const stats = fs.statSync(file_path);
    if (stats.isDirectory()) {
      rm_rf_all(file_path, db);
    // Only care about deleting the .json files.
    } else if (file_path.length - file_path.lastIndexOf('.json') === 5) {
      try {
        fs.unlinkSync(file_path);
      } catch (err) {
        return { path: file_path, err };
      }
    }
  }

  try {
    fs.rmdirSync(dir);
  } catch (err) {
    return { path: dir, err };
  }
}


JSONDB.prototype.exists = function exists(key) {
  checkKey(this, key);

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

  if (rpath === this.index.disk_path)
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

  if (rpath === db.index.disk_path)
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


function checkKey(db, key) {
  if (key.charAt(0) !== '/')
    throw new Error('all keys must start with a "/"');
  if (key === db.index.index_key)
    throw new Error('attempting to access the database index');
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
