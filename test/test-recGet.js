'use strict';

const jsondb = require('../main');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../test-json-db-store');
const db = jsondb(dbPath);

// Helper function to set up the test environment
function setupTestEnvironment() {
  // Create test directories and files
  fs.mkdirSync(path.join(dbPath, 'testDir'), { recursive: true });
  fs.mkdirSync(path.join(dbPath, 'testDir/nestedDir'), { recursive: true });

  fs.writeFileSync(path.join(dbPath, 'testDir/file1.json'),
                   JSON.stringify({ data: 'file1' }));
  fs.writeFileSync(path.join(dbPath, 'testDir/file2.json'),
                   JSON.stringify({ data: 'file2' }));
  fs.writeFileSync(path.join(dbPath, 'testDir/nestedDir/file3.json'),
                   JSON.stringify({ data: 'file3' }));
  fs.writeFileSync(path.join(dbPath, 'testDir/nestedDir/file4.json'),
                   JSON.stringify({ data: 'file4' }));
}

// Cleanup function to remove the test environment
function cleanupTestEnvironment() {
  fs.rmSync(dbPath, { recursive: true, force: true });
}

// Run tests
function runTests() {
  setupTestEnvironment();

  try {
    // Test 1: Basic functionality
    const results1 = db.recGet('/testDir', /\.json$/);
    assert.deepStrictEqual(results1.sort(), [
      path.join(dbPath, 'testDir/file1.json'),
      path.join(dbPath, 'testDir/file2.json'),
      path.join(dbPath, 'testDir/nestedDir/file3.json'),
      path.join(dbPath, 'testDir/nestedDir/file4.json')
    ].sort(), 'Expected to find all .json files');

    // Test 2: Non-existent files
    const results2 = db.recGet('/testDir', /nonexistent/);
    assert.deepStrictEqual(results2,
                           [],
                           'Expected no files to match the regex');

    // Test 3: Empty directory
    const emptyDirPath = path.join(dbPath, 'emptyDir');
    fs.mkdirSync(emptyDirPath);
    const results3 = db.recGet('/emptyDir', /\.json$/);
    assert.deepStrictEqual(results3,
                           [],
                           'Expected no files in the empty directory');

    // Test 4: Nested directories
    const results4 = db.recGet('/testDir/nestedDir', /\.json$/);
    assert.deepStrictEqual(results4.sort(), [
      path.join(dbPath, 'testDir/nestedDir/file3.json'),
      path.join(dbPath, 'testDir/nestedDir/file4.json')
    ].sort(), 'Expected to find .json files in the nested directory');

    console.log('All recGet tests passed successfully!');
  } catch (error) {
    console.error('Test failed:', error.stack);
  } finally {
    cleanupTestEnvironment();
  }
}

// Execute the tests
runTests();
