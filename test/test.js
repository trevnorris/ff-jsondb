'use strict';

const jsondb = require('../main');
const print = process._rawDebug;

const db = jsondb('../test-json-db-store');

//db.index.set('get_a_f', /^\/genRand\/[^/]*$/, '/indexes/0_9', function(key, json) {
  //var ret = { 'a_f': [] };
  //for (var i in json) {
    //if (/[a-f]/.test(i.charAt(0))) {
      //ret['a_f'].push([i, key]);
    //}
  //}
  //return ret;
//});

//for (var i = 0; i < 100; i++) {
  //db.set('/genRand/' + Math.random().toString(36).substr(2),
         //{ [Math.random().toString(16).substr(2)]: i });
//}

//db.del('/indexes/0_9');
//let err = db.rm_rf('/genRand');
//if (err) console.log(err);



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
