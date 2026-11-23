import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureWritableFetch, isBenignExtensionFetchError } from './safeWindowFetch';

test('ensureWritableFetch allows assignment when own fetch property has only a getter', () => {
  const mockWin: Record<string, unknown> = {};
  const nativeFetch = () => 'native-response';

  Object.defineProperty(mockWin, 'fetch', {
    configurable: true,
    enumerable: true,
    get() {
      return nativeFetch;
    },
  });

  assert.throws(() => {
    mockWin.fetch = () => 'wrapped';
  }, TypeError);

  const patched = ensureWritableFetch(mockWin);
  assert.equal(patched, true);
  assert.equal((mockWin.fetch as () => string)(), 'native-response');

  const orig = mockWin.fetch as () => string;
  mockWin.fetch = () => `wrapped:${orig()}`;
  assert.equal((mockWin.fetch as () => string)(), 'wrapped:native-response');
});

test('ensureWritableFetch allows assignment when prototype fetch has only a non-configurable getter', () => {
  const proto: Record<string, unknown> = {};
  const protoFetch = () => 'proto-fetch';
  Object.defineProperty(proto, 'fetch', {
    configurable: false,
    enumerable: true,
    get() {
      return protoFetch;
    },
  });

  const mockWin = Object.create(proto) as Record<string, unknown>;
  assert.throws(() => {
    mockWin.fetch = () => 'override';
  }, TypeError);

  const patched = ensureWritableFetch(mockWin);
  assert.equal(patched, true);
  assert.equal((mockWin.fetch as () => string)(), 'proto-fetch');

  mockWin.fetch = () => 'extension-wrapped';
  assert.equal((mockWin.fetch as () => string)(), 'extension-wrapped');
});

test('ensureWritableFetch returns false without throwing when own getter-only fetch is non-configurable', () => {
  const lockedWin: Record<string, unknown> = {};
  Object.defineProperty(lockedWin, 'fetch', {
    configurable: false,
    get() {
      return () => 'locked';
    },
  });

  assert.equal(ensureWritableFetch(lockedWin), false);
});

test('isBenignExtensionFetchError matches chrome-extension scripts and getter-only fetch error', () => {
  assert.equal(
    isBenignExtensionFetchError(
      'chrome-extension://almalgbpmcfpdaopimbdchdliminoign/executors/200.js',
      'TypeError: Cannot set property fetch of #<Window> which has only a getter'
    ),
    true
  );
  assert.equal(
    isBenignExtensionFetchError(
      'http://localhost:3000/src/App.tsx',
      'ReferenceError: foo is not defined'
    ),
    false
  );
});
