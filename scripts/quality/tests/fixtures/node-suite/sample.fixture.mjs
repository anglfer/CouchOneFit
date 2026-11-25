// Fixture ejecutado por node-reporter.test.mjs; no forma parte de la suite.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

test('passes', () => {
  assert.equal(1 + 1, 2);
});

test('fails with deepStrictEqual', () => {
  assert.deepStrictEqual({ total: 2 }, { total: 3 });
});

test('is skipped', { skip: 'motivo' }, () => {});

describe('outer', () => {
  describe('inner', () => {
    test('nested passes', () => {});
    test('nested throws', () => {
      throw new Error('boom');
    });
  });
});
