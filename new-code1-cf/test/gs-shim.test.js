import { describe, it, expect } from 'vitest';
import shimSrc from '../public/gs-shim.js?raw';

function loadShim(transport) {
  const win = {};
  const fakeFetch = (url, opts) => transport(url, opts);
  new Function('window', 'fetch', shimSrc)(win, fakeFetch);
  return win;
}

function makeTransport(latencies) {
  return (url, opts) => {
    const { fn } = JSON.parse(opts.body);
    const delay = latencies[fn] || 1;
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ok: true, json: async () => ({ fn }) });
      }, delay);
    });
  };
}

function callWith(run, fn) {
  return new Promise((resolve, reject) => {
    run.withSuccessHandler(resolve).withFailureHandler(reject)[fn]();
  });
}

describe('gs-shim google.script.run', () => {
  it('resolves concurrent inline calls with their own results', async () => {
    const win = loadShim(makeTransport({ a: 5, b: 20 }));
    const call = (fn) =>
      new Promise((resolve, reject) => {
        win.google.script.run.withSuccessHandler(resolve).withFailureHandler(reject)[fn]();
      });
    const [ra, rb] = await Promise.all([call('a'), call('b')]);
    expect(ra).toEqual({ fn: 'a' });
    expect(rb).toEqual({ fn: 'b' });
  });

  it('keeps concurrent calls independent on a captured runner', async () => {
    const win = loadShim(makeTransport({ a: 5, b: 20 }));
    const run = win.google.script.run;
    const [ra, rb] = await Promise.all([callWith(run, 'a'), callWith(run, 'b')]);
    expect(ra).toEqual({ fn: 'a' });
    expect(rb).toEqual({ fn: 'b' });
  });

  it('routes failures to the handler of the matching call', async () => {
    const win = loadShim((url, opts) => {
      const { fn } = JSON.parse(opts.body);
      return new Promise((resolve) => {
        setTimeout(() => resolve({ ok: false, status: 500, json: async () => ({ error: fn + ' failed' }) }), fn === 'a' ? 5 : 20);
      });
    });
    const run = win.google.script.run;
    const results = await Promise.allSettled([callWith(run, 'a'), callWith(run, 'b')]);
    expect(results[0].status).toBe('rejected');
    expect(results[0].reason.message).toBe('a failed');
    expect(results[1].status).toBe('rejected');
    expect(results[1].reason.message).toBe('b failed');
  });
});
