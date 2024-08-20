## ff-jsondb

ff-jsondb is a simple and (currently) unoptimized flat file JSON database. It
was created to allow reading/writing to the database without use of this API,
and to be minimal and straight forward. The entire API is synchronous, and I
don't feel bad about that one bit.


### API

#### `jsondb(db_path)`

* `db_path` {String}
* Returns new `JSONDB()` instance

`require('ff-jsondb')` returns a function that creates a new `JSONDB()`
instance at the given `db_path`. `db_path` is the path to the folder to the
database. A relative `db_path` is resolved against the script's `process.cwd()`
(i.e. the path where the script was executed).


#### `db.get(key[, regex_name[, callback]])`

* `key` {String}
* `regex_name` {RegExp}
* `callback` {Function}
* Returns {Object}

Retrieve the JSON file(s) at given `key`. The `key` is actually a folder path
and file name of the JSON file. For example:

```js
db.get('/foo/bar');
```

Where from `db_path` in the folder `foo/` it will retrieve the file `bar`
(technically `bar.json`, but for simplicity that's omitted). So it is possible
to store data in the same path as the file. For example:

```js
db.set('/foo/bar', { foo: 'bar' });
db.set('/foo/bar/baz', { bar: 'baz' });
```

If `regex_name` is passed then a directory lookup is done for all files
matching the passed `RegExp`. The return value is an `Object` whose keys are
the names of the matching entries.

If `callback` is passed then each entry that matches `regex_name` will be
passed to `callback`. This is to help prevent cases where there are too many
matches to be contained in one object. Here's an example:

```js
db.get('/path', /pattern/, function(id, data) {
  // The "this" of the callback is always the "db".
  // "id" is the name of the entry.
  // "data" is the json object in the entry.
});
```

Remember that this operation is not asynchronous. If `callback` is passed then
`db.get()` will return `undefined`. If `callback` returns `true` then the
operation will stop and no more entries will be passed to the user.


#### `db.recGet(key, regex)`

* `key` {String}: The folder path from which to start the search. This path is
  relative to the database's root directory.
* `regex` {RegExp}: A regular expression used to match file names. Only files
  that match this regex will be included in the results.
* Returns {Array}: An array of file paths that match the given regex pattern.
  If no files match, an empty array is returned.

The `db.recGet()` method allows you to perform a recursive search for JSON
files within a specified directory and its subdirectories. It uses the provided
regular expression to filter the files that are returned.

This method is particularly useful when you need to find files that match a
certain naming pattern across multiple levels of directories without having to
manually traverse each folder.


#### `db.getRaw(key[, regex_name[, callback]])`

* `key` {String}
* `regex_name` {RegExp}
* `callback` {Function}
* Returns {Buffer} or {Object}

Same as `db.get()` except instead of automatically running `JSON.parse()` on
the data it returns a `Buffer` or an `Object` of `Buffer`s.


#### `db.set(key, value)`

* `key` {String}
* `value` {Buffer}, {String} or {Object}

Replace contents at `key` with `value`. Sorry, it's all or nothing here. Either
a `Buffer`, `String` or `Object` can be passed. `Object`s will be passed to
`JSON.stringify()`.


#### `db.del(key)`

Delete entry at location `key`. `key` is always a file, not a directory. So no
deleting many records at once. For now at least.


#### `db.exists(key)`

* `key` {String}
* Returns {Boolean}

Return whether the key entry exists in the database.


#### `db.listEntries(key[, regex])`

* `key` {String}
* `regex` {RegExp} Optional
* Returns {Array} of matches

Returns an array of matches at `key` of any JSON files.


#### `db.listDirs(key[, regex])`

* `key` {String}
* `regex` {RegExp} Optional
* Returns {Array} of matches

Returns an array of matches at `key` of any directories.


#### `db.countEntries(key[, regex])`

* `key` {String}
* `regex` {RegExp} Optional
* Returns {Number} of matching results

Get the number of entries matching `key` and `regex`.
