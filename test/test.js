'use strict';

const jsondb = require('../main');
const print = process._rawDebug;

const db = jsondb('../test-json-db-store');

db.set('/foo/bar', { foo: 'bar' });
print(db.get('/foo/bar'));
db.del('/foo/bar');
print(db.get('/foo/bar'));
/* */


for (var i = 0; i < 100; i++) {
  db.set('/foo/' + Math.random().toString(32).substr(2), { val: Math.random() });
}

const files = db.get('/foo', /^s.*/);
print(files);
