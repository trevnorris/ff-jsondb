'use strict';

const jsondb = require('../main');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../test-json-db-store');
const db = jsondb(dbPath);

// Ensure the test database directory exists
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath);
}

// Cleanup function to remove the test database after tests
function cleanup() {
  fs.rmSync(dbPath, { recursive: true, force: true });
}

// Run tests
function runTests() {
  try {
    // Test for set and get
    db.set('/foo/bar', { foo: 'baz' });
    const result = db.get('/foo/bar');
    assert.deepStrictEqual(result,
                           { foo: 'baz' },
                           'Expected value to be { foo: "baz" }');

    // Test for getting a non-existent key
    const nonExistentResult = db.get('/nonexistent/key');
    assert.strictEqual(nonExistentResult,
                       null,
                       'Expected result to be null for non-existent key');

    // Test for delete
    const deleteResult = db.del('/foo/bar');
    assert.strictEqual(deleteResult,
                       true,
                       'Expected delete to return true');
    const afterDeleteResult = db.get('/foo/bar');
    assert.strictEqual(afterDeleteResult,
                       null,
                       'Expected result to be null after deletion');

    // Test for deleting a non-existent key
    const deleteNonExistentResult = db.del('/nonexistent/key');
    assert.strictEqual(deleteNonExistentResult,
                       false,
                       'Expected delete to return false for non-existent key');

    // Test for exists
    db.set('/foo/bar', { foo: 'baz' });
    const existsResult = db.exists('/foo/bar');
    assert.strictEqual(existsResult,
                       true,
                       'Expected exists to return true for existing key');

    // Test for non-existent key in exists
    const existsNonExistentResult = db.exists('/nonexistent/key');
    assert.strictEqual(existsNonExistentResult,
                       false,
                       'Expected exists to return false for non-existent key');

    // Test for listEntries
    db.set('/foo/entry1', { data: 'test1' });
    db.set('/foo/entry2', { data: 'test2' });
    db.set('/foo/other', { data: 'test3' });
    const entries = db.listEntries('/foo', /^entry/);
    assert.deepStrictEqual(entries,
                           ['entry1', 'entry2'],
                           'Expected entries to match');

    // Test for counting entries
    const count = db.countEntries('/foo', /^entry/);
    assert.strictEqual(count, 2, 'Expected count to be 2');

    // Test for counting non-existent entries
    const countNonExistent = db.countEntries('/foo', /^nonexistent/);
    assert.strictEqual(countNonExistent,
                       0,
                       'Expected count to be 0 for non-existent entries');

    console.log('All tests passed successfully!');
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    cleanup();
  }
}

// Execute the tests
runTests();
