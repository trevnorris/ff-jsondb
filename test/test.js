'use strict';

const jsondb = require('../main');
const print = process._rawDebug;

const db = jsondb('../test-json-db-store');


db.index.set('get_0_9', /^\/genRand\/[^/]*$/, '/indexes/0_9', function(key, json) {
  var ret = { '0_9': [] };
  for (var i in json) {
    if (/[0-9]/.test(i.charAt(0))) {
      ret['0_9'].push([i, key]);
    }
  }
  return ret;
});


//db.set('/genRand/foop', { 42: 'foo' });


for (var i = 0; i < 100; i++) {
  db.set('/genRand/' + Math.random().toString(36).substr(2),
         { [Math.random().toString(16).substr(2)]: i });
}



//db.index.set('test1', /^\/foo.*$/, '/indexes/foo', function (json, index) {
  //console.log(index);
  //index.foo = 'bar';
//});

//db.set('/foo/bar', { foo: 'baz' });
//print(db.get('/foo/bar'));
//db.del('/foo/bar');
//print(db.get('/foo/bar'));
/* */


/*
for (var i = 0; i < 100; i++) {
  db.set('/foo/' + Math.random().toString(32).substr(2),
         { val: Math.random() });
}
/* */

/*
db.listEntries('/foo', /.*$/).forEach(name => {
  db.del('/foo' + '/' + name);
});
/* */

//const files = db.get('/foo', /^s.*$/);
//print(files);

//db.get('/foo', /^s.*$/, (name, data) => {
  //print(name, data);
//});
