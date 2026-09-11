(function () {
  function rpc(fn, args) {
    return fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn: fn, args: args })
    }).then(function (res) {
      return res.json().catch(function () { return { error: 'Respons tidak valid' }; }).then(function (data) {
        if (!res.ok || (data && data.error)) {
          var msg = (data && (data.error || data.message)) || ('HTTP ' + res.status);
          var err = new Error(msg);
          throw err;
        }
        return data;
      });
    });
  }

  function makeRunner(successHandler, failureHandler) {
    var onSuccess = successHandler || function () {};
    var onFailure = failureHandler || function () {};
    var proxy;

    function derive(nextSuccess, nextFailure) {
      return makeRunner(
        nextSuccess === undefined ? onSuccess : nextSuccess,
        nextFailure === undefined ? onFailure : nextFailure
      );
    }

    var base = {
      withSuccessHandler: function (fn) { return derive(typeof fn === 'function' ? fn : onSuccess, undefined); },
      withFailureHandler: function (fn) { return derive(undefined, typeof fn === 'function' ? fn : onFailure); }
    };
    proxy = new Proxy(base, {
      get: function (target, prop) {
        if (prop in target) return target[prop];
        return function () {
          var args = Array.prototype.slice.call(arguments);
          rpc(String(prop), args).then(function (r) { onSuccess(r); }).catch(function (e) { onFailure(e); });
        };
      }
    });
    return proxy;
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner();
})();
