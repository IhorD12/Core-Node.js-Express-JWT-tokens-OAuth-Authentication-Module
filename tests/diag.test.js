// tests/diag.test.js
describe('Diagnostic Test for Module Resolution', () => {
  it('should log module.paths for diagnostics', () => {
    console.log('module.paths inside diag.test.js:', module.paths);
    // This test doesn't assert anything, just logs.
    // It can be removed or commented out after diagnosis.
    expect(true).toBe(true);
  });

  it('should be able to require dotenv', () => {
    let dotenv;
    try {
      dotenv = require('dotenv');
    } catch (e) {
      console.error("Failed to require dotenv:", e);
      throw e; // Re-throw to make test fail clearly
    }
    expect(dotenv).toBeDefined();
    expect(typeof dotenv.config).toBe('function');
  });

  it('should be able to require supertest', () => {
    let supertest;
    try {
      supertest = require('supertest');
    } catch (e) {
      console.error("Failed to require supertest:", e);
      throw e;
    }
    expect(supertest).toBeDefined();
  });

  it('should be able to require passport (dependency of a source file)', () => {
    let passport;
    try {
      // This test is slightly different as passport might be required by source files,
      // not directly by a test file. If src/middleware/authMiddleware.js fails to find it,
      // it means the resolution issue affects modules required by the application code under test.
      passport = require('passport');
    } catch (e) {
      console.error("Failed to require passport directly in test:", e);
      // Now try to require a module that itself requires passport
      try {
        require('../../src/middleware/authMiddleware'); // This file requires 'passport'
        console.log("Successfully required authMiddleware, so it found 'passport'.");
      } catch (e2) {
        console.error("Failed to require authMiddleware (which requires passport):", e2);
        throw e2; // Prioritize the error from the app code's require
      }
    }
    expect(passport).toBeDefined(); // This will only be hit if direct require works
  });
});
