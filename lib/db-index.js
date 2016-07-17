'use strict';

const fs = require('fs');
const resolvePath = require('./util').resolvePath;

module.exports = DBIndex;


// db {Object} - A JSONDB instance.
// index_key {String} - The same type of key that would be passed to JSONDB.
function DBIndex(db, index_key) {
  if (index_key === undefined)
    index_key = '/.dbindex';
  if (typeof index_key !== 'string')
    throw new TypeError('index_key must be a string');
  if (index_key.charAt(0) !== '/')
    throw new Error('index_key does not start with "/"');

  // I don't care if users look at the contents of the instance, but know
  // that everything here is considered READ-ONLY!
  this.db = db;
  this.index_key = index_key;
  // Adding the extra '/f' there to force creation of the directory if it
  // hasn't been created yet.
  this.disk_path = resolvePath(db.path + '/' + index_key + '/f').slice(0, -2);
  this.indexes = null;

  // Read the JSON of indexes that have been created by the user, if they
  // exist. If not create a new file and new object that will hold the
  // indexes.
  const indexes_str =
      fs.readFileSync(this.disk_path + '/indexes', { flag: 'a+' }).toString();
  // Before writing the indexes JSON to disk it needs to be process so the
  // information can be properly retrieved.
  if (indexes_str.length > 0)
    this.indexes = processIndexFile(JSON.parse(indexes_str));
  else
    this.indexes = { entries_processed: {}, index_names: [], index_entries: {} };
  // entries_processed: Entries in the database that have been indexed. Useful
  //   when checking to see what files need to be indexed if files were added
  //   when the index wasn't running. Is a tree by path for faster lookup and
  //   to reduce space on disk. The final value at each leaf is the time the
  //   dababase entry was processed. This way can also reprocess files that
  //   have changed
  // index_names: The names of all indexes currently in the index.
  // index_entries: The operations for all
}


function processIndexFile(index_data) {
  for (let i in index_data.index_entries) {
    const entry = index_data.index_entries[i];
    if (entry.filter.type === 'regexp')
      entry.filter.value = new Function('return ' + entry.filter.value)();
    entry.fn = new Function('return ' + entry.fn)();
  }
  return index_data;
}


// List all indexes currently in the database.
DBIndex.prototype.list = function list() {
  return this.indexes.index_names.slice();
};


// Add a new index to the database.
// Each object returned from the index callback should be unique for the key
// that's being processed. Meaning, indexing of any one db key should not
// alter any entries on another db key.
//
// XXX: Only way to enforce this is to track all db keys being added and check
// if something already exists when being written, verify if the db key
// replacing it is the same as the db key that added it initially.
//
// XXX: See how possible it would be to always make sure "require" and such
// are available to the callback. Basically the same thing as in reblaze.
//
// XXX: Contemplate having a "cleanup" callback the user supplies that will
// tell us how to cleanup each entry. That way DBIndex doesn't need to track
// every object added by the user.
//
// Arguments are as follows:
//  set(name, filter, entry_key, callback)
// - name {String} name of the index to be added (what should be done if a
//   filter that's about to be added has already been added?)
// - filter {String} or {RegExp} whenever data is written via set() the
//   "key" is checked against "filter" for a match.
// - path {String} location where the indexed data should be saved (currently
//   only a single file, but allowing a dir and breaking up the filtered data
//   into separate files would be helpful).
// - callback {Function} the data that's about to be written via get() is
//   passed to "callback" and the "this" of the callback is that of the
//   database. The return value of the callback is an object that is
//   recursively merged into the index.
DBIndex.prototype.set = function set(name, filter, entry_key, callback) {
  //  {
  //    "<name>": {
  //      "filter": {
  //        "type": "(string|regexp)",
  //        "value": "<filter>"
  //      },
  //      "entry_key": "<path>",
  //      "fn": "<callback>.toString()"
  //    }
  //  }

  if (typeof name !== 'string')
    throw new TypeError('name must be a string');
  if (typeof filter !== 'string' && !(filter instanceof RegExp))
    throw new TypeError('filter must be a string or a regexp');
  if (typeof entry_key !== 'string')
    throw new TypeError('entry_key must be a string');
  if (typeof callback !== 'function')
    throw new TypeError('callback must be a string');

  // XXX: Issue for my use case, I don't want to have to store a massive
  // object of the halo 5 metadata in my index. It also needs to be updated
  // once in a while. Possibly allow this object to be passed in at
  // construction time, or add a method for it that you pass an object with
  // keys and objects that will then be passed to the function being called.
  this.indexes.index_entries[name] = {
    filter: {
      type: typeof filter === 'string' ? 'string' : 'regexp',
      value: filter,
    },
    entry_key,
    fn: callback,
  };

  // Not anticipating this list to be very big, so not planning on performing
  // any optimizations as far as storage/retrieval.
  if (this.indexes.index_names.indexOf(name) === -1)
    this.indexes.index_names.push(name);

  writeIndexToDisk(`${this.disk_path}/indexes`, this.indexes);
};


// Delete a key in the index. The files generated by this index will be left
// on disk.
DBIndex.prototype.del = function del(name) {
  if (typeof name !== 'string')
    throw new TypeError('name must be a string');
  delete this.indexes.index_entries[name];
  this.indexes.index_names.splice(this.indexes.index_names.indexOf(name), 1);
  writeIndexToDisk(`${this.disk_path}/indexes`, this.indexes);
};


// Reinitialize all keys. May take a long time to process, but useful in
// case there's possible corruption of indexed data.
DBIndex.prototype.reindex = function reindex(name) {
  // XXX: do everything.
};


// [internal] New data is being written to disk. Process it and add the
// values to the index.
DBIndex.prototype._process = function _process(key, json) {
  // "json" can be {Buffer}, {String} or {Object}. Convert the first two.
  if (Buffer.isBuffer(json) || typeof json === 'string')
    json = JSON.parse(json);

  // Iterate through all indexes and pass data to appropriate callbacks.
  // Could possibly make this faster by creatin a list of all the filters,
  // but assuming there aren't thousands of them the performance shouldn't
  // be an issue.
  for (let i in this.indexes.index_entries) {
    const entry = this.indexes.index_entries[i];
    if ((entry.filter.type === 'string' && entry.filter.value === key) ||
        (entry.filter.type === 'regexp' && entry.filter.value.test(key))) {
      let index_obj = this.db.get(entry.entry_key);
      if (index_obj === null) index_obj = {};  // In case hasn't been created.
      const idata = entry.fn.call(this.db, key, json);
      // If nothing was returned then there's nothing to enter.
      if (!idata) continue;

      // Merge the return values from the indexed item with the existing index
      // object.
      mergeIndexEntry(idata, index_obj);

      // XXX This is going to be very very slow. Could try one of:
      // - Keep a table of most commonly used indexes and keep in memory.
      // - Figure out a way to write out only part of the file.
      // - Keep each key, or group of keys, in separate files.
      this.db.set(entry.entry_key, index_obj);
    }
  }
};


// Merges objects and arrays. Arrays will be merged so only unique entries
// exist.
function mergeIndexEntry(idata, index_obj) {
  for (let i in idata) {
    if (Object.prototype.toString.call(idata[i]) === '[object Object]') {
      if (!index_obj[i]) index_obj[i] = {};
      mergeIndexEntry(idata[i], index_obj[i]);
    } else if (Array.isArray(idata[i])) {
      if (!Array.isArray(index_obj[i])) index_obj[i] = [];
      // XXX: Can do this much more quickly. Since we control the order of the
      // array, keep it sorted then do a bisect for lookup. splice() in the
      // value if it dosn't exist. Though it will be slow if there are many
      // entries to add to a large list. This approach is O(n^2). Not good.
      for (let idx = 0; idx < idata[i].length; idx++) {
        if (index_obj[i].indexOf(idata[i][idx]))
          index_obj[i].push(idata[i][idx]);
      }
    } else {
      index_obj[i] = idata[i];
    }
  }
}


// First need to properly convert values into a format that can be stored in
// a JSON file. Otherwise they'll disappear into the abyss.
function writeIndexToDisk(file_path, data) {
  const converted = { index_names: data.index_names, index_entries: {} };
  for (let i in data.index_entries) {
    const entry = data.index_entries[i];
    converted.index_entries[i] = {
      filter: {
        type: entry.filter.type,
        value: entry.filter.value.toString(),
      },
      entry_key: entry.entry_key,
      fn: entry.fn.toString(),
    };
  }

  fs.writeFileSync(resolvePath(file_path), JSON.stringify(converted));
}
