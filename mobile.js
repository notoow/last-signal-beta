var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// mobile/node_modules/@capacitor/core/dist/index.js
var ExceptionCode, CapacitorException, getPlatformId, createCapacitor, initCapacitorGlobal, Capacitor, registerPlugin, WebPlugin, encode, decode, CapacitorCookiesPluginWeb, CapacitorCookies, readBlobAsBase64, normalizeHttpHeaders, buildUrlParams, buildRequestInit, CapacitorHttpPluginWeb, CapacitorHttp, SystemBarsStyle, SystemBarType, SystemBarsPluginWeb, SystemBars;
var init_dist = __esm({
  "mobile/node_modules/@capacitor/core/dist/index.js"() {
    (function(ExceptionCode2) {
      ExceptionCode2["Unimplemented"] = "UNIMPLEMENTED";
      ExceptionCode2["Unavailable"] = "UNAVAILABLE";
    })(ExceptionCode || (ExceptionCode = {}));
    CapacitorException = class extends Error {
      constructor(message, code, data) {
        super(message);
        this.message = message;
        this.code = code;
        this.data = data;
      }
    };
    getPlatformId = (win) => {
      var _a, _b;
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return "android";
      } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return "ios";
      } else {
        return "web";
      }
    };
    createCapacitor = (win) => {
      const capCustomPlatform = win.CapacitorCustomPlatform || null;
      const cap = win.Capacitor || {};
      const Plugins = cap.Plugins = cap.Plugins || {};
      const getPlatform = () => {
        return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
      };
      const isNativePlatform = () => getPlatform() !== "web";
      const isPluginAvailable = (pluginName) => {
        const plugin = registeredPlugins.get(pluginName);
        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
          return true;
        }
        if (getPluginHeader(pluginName)) {
          return true;
        }
        return false;
      };
      const getPluginHeader = (pluginName) => {
        var _a;
        return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
      };
      const handleError = (err) => win.console.error(err);
      const registeredPlugins = /* @__PURE__ */ new Map();
      const registerPlugin2 = (pluginName, jsImplementations = {}) => {
        const registeredPlugin = registeredPlugins.get(pluginName);
        if (registeredPlugin) {
          console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
          return registeredPlugin.proxy;
        }
        const platform = getPlatform();
        const pluginHeader = getPluginHeader(pluginName);
        let jsImplementation;
        const loadPluginImplementation = async () => {
          if (!jsImplementation && platform in jsImplementations) {
            jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
          } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
            jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
          }
          return jsImplementation;
        };
        const createPluginMethod = (impl, prop) => {
          var _a, _b;
          if (pluginHeader) {
            const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
            if (methodHeader) {
              if (methodHeader.rtype === "promise") {
                return (options) => cap.nativePromise(pluginName, prop.toString(), options);
              } else {
                return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
              }
            } else if (impl) {
              return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
            }
          } else if (impl) {
            return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
          } else {
            throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, ExceptionCode.Unimplemented);
          }
        };
        const createPluginMethodWrapper = (prop) => {
          let remove;
          const wrapper = (...args) => {
            const p = loadPluginImplementation().then((impl) => {
              const fn = createPluginMethod(impl, prop);
              if (fn) {
                const p2 = fn(...args);
                remove = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                return p2;
              } else {
                throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, ExceptionCode.Unimplemented);
              }
            });
            if (prop === "addListener") {
              p.remove = async () => remove();
            }
            return p;
          };
          wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
          Object.defineProperty(wrapper, "name", {
            value: prop,
            writable: false,
            configurable: false
          });
          return wrapper;
        };
        const addListener = createPluginMethodWrapper("addListener");
        const removeListener = createPluginMethodWrapper("removeListener");
        const addListenerNative = (eventName, callback) => {
          const call = addListener({ eventName }, callback);
          const remove = async () => {
            const callbackId = await call;
            removeListener({
              eventName,
              callbackId
            }, callback);
          };
          const p = new Promise((resolve) => call.then(() => resolve({ remove })));
          p.remove = async () => {
            console.warn(`Using addListener() without 'await' is deprecated.`);
            await remove();
          };
          return p;
        };
        const proxy = new Proxy({}, {
          get(_, prop) {
            switch (prop) {
              // https://github.com/facebook/react/issues/20030
              case "$$typeof":
                return void 0;
              case "toJSON":
                return () => ({});
              case "addListener":
                return pluginHeader ? addListenerNative : addListener;
              case "removeListener":
                return removeListener;
              default:
                return createPluginMethodWrapper(prop);
            }
          }
        });
        Plugins[pluginName] = proxy;
        registeredPlugins.set(pluginName, {
          name: pluginName,
          proxy,
          platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
        });
        return proxy;
      };
      if (!cap.convertFileSrc) {
        cap.convertFileSrc = (filePath) => filePath;
      }
      cap.getPlatform = getPlatform;
      cap.handleError = handleError;
      cap.isNativePlatform = isNativePlatform;
      cap.isPluginAvailable = isPluginAvailable;
      cap.registerPlugin = registerPlugin2;
      cap.Exception = CapacitorException;
      cap.DEBUG = !!cap.DEBUG;
      cap.isLoggingEnabled = !!cap.isLoggingEnabled;
      return cap;
    };
    initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
    Capacitor = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
    registerPlugin = Capacitor.registerPlugin;
    WebPlugin = class {
      constructor() {
        this.listeners = {};
        this.retainedEventArguments = {};
        this.windowListeners = {};
      }
      addListener(eventName, listenerFunc) {
        let firstListener = false;
        const listeners = this.listeners[eventName];
        if (!listeners) {
          this.listeners[eventName] = [];
          firstListener = true;
        }
        this.listeners[eventName].push(listenerFunc);
        const windowListener = this.windowListeners[eventName];
        if (windowListener && !windowListener.registered) {
          this.addWindowListener(windowListener);
        }
        if (firstListener) {
          this.sendRetainedArgumentsForEvent(eventName);
        }
        const remove = async () => this.removeListener(eventName, listenerFunc);
        const p = Promise.resolve({ remove });
        return p;
      }
      async removeAllListeners() {
        this.listeners = {};
        for (const listener in this.windowListeners) {
          this.removeWindowListener(this.windowListeners[listener]);
        }
        this.windowListeners = {};
      }
      notifyListeners(eventName, data, retainUntilConsumed) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          if (retainUntilConsumed) {
            let args = this.retainedEventArguments[eventName];
            if (!args) {
              args = [];
            }
            args.push(data);
            this.retainedEventArguments[eventName] = args;
          }
          return;
        }
        listeners.forEach((listener) => listener(data));
      }
      hasListeners(eventName) {
        var _a;
        return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
      }
      registerWindowListener(windowEventName, pluginEventName) {
        this.windowListeners[pluginEventName] = {
          registered: false,
          windowEventName,
          pluginEventName,
          handler: (event) => {
            this.notifyListeners(pluginEventName, event);
          }
        };
      }
      unimplemented(msg = "not implemented") {
        return new Capacitor.Exception(msg, ExceptionCode.Unimplemented);
      }
      unavailable(msg = "not available") {
        return new Capacitor.Exception(msg, ExceptionCode.Unavailable);
      }
      async removeListener(eventName, listenerFunc) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          return;
        }
        const index = listeners.indexOf(listenerFunc);
        if (index !== -1) {
          this.listeners[eventName].splice(index, 1);
        }
        if (!this.listeners[eventName].length) {
          this.removeWindowListener(this.windowListeners[eventName]);
        }
      }
      addWindowListener(handle) {
        window.addEventListener(handle.windowEventName, handle.handler);
        handle.registered = true;
      }
      removeWindowListener(handle) {
        if (!handle) {
          return;
        }
        window.removeEventListener(handle.windowEventName, handle.handler);
        handle.registered = false;
      }
      sendRetainedArgumentsForEvent(eventName) {
        const args = this.retainedEventArguments[eventName];
        if (!args) {
          return;
        }
        delete this.retainedEventArguments[eventName];
        args.forEach((arg) => {
          this.notifyListeners(eventName, arg);
        });
      }
    };
    encode = (str) => encodeURIComponent(str).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
    decode = (str) => str.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
    CapacitorCookiesPluginWeb = class extends WebPlugin {
      async getCookies() {
        const cookies = document.cookie;
        const cookieMap = {};
        cookies.split(";").forEach((cookie) => {
          if (cookie.length <= 0)
            return;
          let [key2, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
          key2 = decode(key2).trim();
          value = decode(value).trim();
          cookieMap[key2] = value;
        });
        return cookieMap;
      }
      async setCookie(options) {
        try {
          const encodedKey = encode(options.key);
          const encodedValue = encode(options.value);
          const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
          const path = (options.path || "/").replace("path=", "");
          const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
          document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path}; ${domain};`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async deleteCookie(options) {
        try {
          document.cookie = `${options.key}=; Max-Age=0`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearCookies() {
        try {
          const cookies = document.cookie.split(";") || [];
          for (const cookie of cookies) {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
          }
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearAllCookies() {
        try {
          await this.clearCookies();
        } catch (error) {
          return Promise.reject(error);
        }
      }
    };
    CapacitorCookies = registerPlugin("CapacitorCookies", {
      web: () => new CapacitorCookiesPluginWeb()
    });
    readBlobAsBase64 = async (blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result;
        resolve(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
    normalizeHttpHeaders = (headers = {}) => {
      const originalKeys = Object.keys(headers);
      const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
      const normalized = loweredKeys.reduce((acc, key2, index) => {
        acc[key2] = headers[originalKeys[index]];
        return acc;
      }, {});
      return normalized;
    };
    buildUrlParams = (params, shouldEncode = true) => {
      if (!params)
        return null;
      const output = Object.entries(params).reduce((accumulator, entry) => {
        const [key2, value] = entry;
        let encodedValue;
        let item;
        if (Array.isArray(value)) {
          item = "";
          value.forEach((str) => {
            encodedValue = shouldEncode ? encodeURIComponent(str) : str;
            item += `${key2}=${encodedValue}&`;
          });
          item.slice(0, -1);
        } else {
          encodedValue = shouldEncode ? encodeURIComponent(value) : value;
          item = `${key2}=${encodedValue}`;
        }
        return `${accumulator}&${item}`;
      }, "");
      return output.substr(1);
    };
    buildRequestInit = (options, extra = {}) => {
      const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
      const headers = normalizeHttpHeaders(options.headers);
      const type = headers["content-type"] || "";
      if (typeof options.data === "string") {
        output.body = options.data;
      } else if (type.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams();
        for (const [key2, value] of Object.entries(options.data || {})) {
          params.set(key2, value);
        }
        output.body = params.toString();
      } else if (type.includes("multipart/form-data") || options.data instanceof FormData) {
        const form = new FormData();
        if (options.data instanceof FormData) {
          options.data.forEach((value, key2) => {
            form.append(key2, value);
          });
        } else {
          for (const key2 of Object.keys(options.data)) {
            form.append(key2, options.data[key2]);
          }
        }
        output.body = form;
        const headers2 = new Headers(output.headers);
        headers2.delete("content-type");
        output.headers = headers2;
      } else if (type.includes("application/json") || typeof options.data === "object") {
        output.body = JSON.stringify(options.data);
      }
      return output;
    };
    CapacitorHttpPluginWeb = class extends WebPlugin {
      /**
       * Perform an Http request given a set of options
       * @param options Options to build the HTTP request
       */
      async request(options) {
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
        const url = urlParams ? `${options.url}?${urlParams}` : options.url;
        const response = await fetch(url, requestInit);
        const contentType = response.headers.get("content-type") || "";
        let { responseType = "text" } = response.ok ? options : {};
        if (contentType.includes("application/json")) {
          responseType = "json";
        }
        let data;
        let blob;
        switch (responseType) {
          case "arraybuffer":
          case "blob":
            blob = await response.blob();
            data = await readBlobAsBase64(blob);
            break;
          case "json":
            data = await response.json();
            break;
          case "document":
          case "text":
          default:
            data = await response.text();
        }
        const headers = {};
        response.headers.forEach((value, key2) => {
          headers[key2] = value;
        });
        return {
          data,
          headers,
          status: response.status,
          url: response.url
        };
      }
      /**
       * Perform an Http GET request given a set of options
       * @param options Options to build the HTTP request
       */
      async get(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
      }
      /**
       * Perform an Http POST request given a set of options
       * @param options Options to build the HTTP request
       */
      async post(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
      }
      /**
       * Perform an Http PUT request given a set of options
       * @param options Options to build the HTTP request
       */
      async put(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
      }
      /**
       * Perform an Http PATCH request given a set of options
       * @param options Options to build the HTTP request
       */
      async patch(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
      }
      /**
       * Perform an Http DELETE request given a set of options
       * @param options Options to build the HTTP request
       */
      async delete(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
      }
    };
    CapacitorHttp = registerPlugin("CapacitorHttp", {
      web: () => new CapacitorHttpPluginWeb()
    });
    (function(SystemBarsStyle2) {
      SystemBarsStyle2["Dark"] = "DARK";
      SystemBarsStyle2["Light"] = "LIGHT";
      SystemBarsStyle2["Default"] = "DEFAULT";
    })(SystemBarsStyle || (SystemBarsStyle = {}));
    (function(SystemBarType2) {
      SystemBarType2["StatusBar"] = "StatusBar";
      SystemBarType2["NavigationBar"] = "NavigationBar";
    })(SystemBarType || (SystemBarType = {}));
    SystemBarsPluginWeb = class extends WebPlugin {
      async setStyle() {
        this.unavailable("not available for web");
      }
      async setAnimation() {
        this.unavailable("not available for web");
      }
      async show() {
        this.unavailable("not available for web");
      }
      async hide() {
        this.unavailable("not available for web");
      }
    };
    SystemBars = registerPlugin("SystemBars", {
      web: () => new SystemBarsPluginWeb()
    });
  }
});

// mobile/node_modules/@capacitor/app/dist/esm/web.js
var web_exports = {};
__export(web_exports, {
  AppWeb: () => AppWeb
});
var AppWeb;
var init_web = __esm({
  "mobile/node_modules/@capacitor/app/dist/esm/web.js"() {
    init_dist();
    AppWeb = class extends WebPlugin {
      constructor() {
        super();
        this.handleVisibilityChange = () => {
          const data = {
            isActive: document.hidden !== true
          };
          this.notifyListeners("appStateChange", data);
          if (document.hidden) {
            this.notifyListeners("pause", null);
          } else {
            this.notifyListeners("resume", null);
          }
        };
        document.addEventListener("visibilitychange", this.handleVisibilityChange, false);
      }
      exitApp() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getInfo() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getLaunchUrl() {
        return { url: "" };
      }
      async getState() {
        return { isActive: document.hidden !== true };
      }
      async minimizeApp() {
        throw this.unimplemented("Not implemented on web.");
      }
      async toggleBackButtonHandler() {
        throw this.unimplemented("Not implemented on web.");
      }
      async getAppLanguage() {
        return {
          value: navigator.language.split("-")[0].toLowerCase()
        };
      }
    };
  }
});

// mobile/mobile.js
init_dist();

// mobile/node_modules/@capacitor/app/dist/esm/index.js
init_dist();
var App = registerPlugin("App", {
  web: () => Promise.resolve().then(() => (init_web(), web_exports)).then((m) => new m.AppWeb())
});

// mobile/native-storage.js
init_dist();
var allowed = (key2) => key2.startsWith("lastsignal.") || key2 === "threadwake.v1";
async function initializeNativeStorage() {
  if (Capacitor.getPlatform() !== "android") return;
  const native = registerPlugin("GameSaves");
  const notice = document.createElement("div");
  notice.id = "mobileSaveStatus";
  notice.setAttribute("role", "status");
  document.body.append(notice);
  const setStatus = (status) => {
    document.documentElement.dataset.mobileSave = status;
    notice.dataset.state = status;
    const en = document.documentElement.lang === "en";
    notice.textContent = status === "saved" ? en ? "Saved on device" : "\uAE30\uAE30 \uC800\uC7A5 \uC644\uB8CC" : status === "saving" ? en ? "Saving on device\u2026" : "\uAE30\uAE30\uC5D0 \uC800\uC7A5 \uC911\u2026" : en ? "Device save failed. Pause and save again." : "\uAE30\uAE30 \uC800\uC7A5 \uC2E4\uD328 \xB7 \uC77C\uC2DC\uC815\uC9C0\uC5D0\uC11C \uB2E4\uC2DC \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.";
  };
  const original = { set: Storage.prototype.setItem, remove: Storage.prototype.removeItem, clear: Storage.prototype.clear };
  const keys = () => Object.keys(localStorage).filter(allowed);
  const checkpoint = await native.read();
  if (checkpoint.initialized) {
    for (const key2 of keys()) original.remove.call(localStorage, key2);
    for (const [key2, value] of Object.entries(checkpoint.values)) if (allowed(key2)) original.set.call(localStorage, key2, value);
  } else {
    await native.initialize({ values: Object.fromEntries(keys().map((key2) => [key2, localStorage.getItem(key2)])) });
  }
  let pending = Promise.resolve(), revision = 0;
  const failed = /* @__PURE__ */ new Set();
  function queue(key2, value, remove = false) {
    const current = ++revision;
    setStatus("saving");
    pending = pending.catch(() => {
    }).then(() => native.write({ key: key2, value, remove })).then(() => {
      failed.delete(key2);
      if (current === revision) setStatus(failed.size ? "error" : "saved");
    }, () => {
      failed.add(key2);
      if (current === revision) setStatus("error");
    });
  }
  Storage.prototype.setItem = function(key2, value) {
    original.set.call(this, key2, value);
    if (this === localStorage && allowed(String(key2))) queue(String(key2), String(value));
  };
  Storage.prototype.removeItem = function(key2) {
    original.remove.call(this, key2);
    if (this === localStorage && allowed(String(key2))) queue(String(key2), null, true);
  };
  Storage.prototype.clear = function() {
    const removed = this === localStorage ? keys() : [];
    original.clear.call(this);
    for (const key2 of removed) queue(key2, null, true);
  };
  setStatus("saved");
}

// mobile/mobile.js
try {
  await initializeNativeStorage();
} catch {
  const failure = document.createElement("main");
  failure.className = "mobile-storage-failure";
  failure.innerHTML = "<h1>\uC800\uC7A5 \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4</h1><p>\uAE30\uC874 \uAE30\uB85D\uC744 \uBCF4\uD638\uD558\uAE30 \uC704\uD574 \uC2DC\uC791\uC744 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4. \uC571\uC744 \uB2E4\uC2DC \uC2E4\uD589\uD574 \uC8FC\uC138\uC694.</p><button>\uB2E4\uC2DC \uC2DC\uB3C4 / Retry</button>";
  failure.querySelector("button").onclick = () => location.reload();
  document.body.append(failure);
  throw new Error("Native save restore failed; game startup stopped");
}
var gameEntry = "./mobile-src/rescue-app.js";
await import(gameEntry);
var pad = document.createElement("nav");
pad.id = "mobileControls";
pad.setAttribute("aria-label", "\uD130\uCE58 \uC870\uC791 / Touch controls");
pad.innerHTML = '<div id="mobileStick" role="group" aria-label="\uC774\uB3D9 / Move"><i id="mobileThumb"></i><span>\uC774\uB3D9</span></div><div id="mobileActions"></div>';
document.body.append(pad);
var rotate = document.createElement("div");
rotate.id = "mobileRotate";
rotate.setAttribute("role", "dialog");
rotate.setAttribute("aria-label", "\uAC00\uB85C \uD654\uBA74 \uC548\uB0B4");
rotate.innerHTML = '<div class="rotate-card"><div class="rotate-phone" aria-hidden="true">\u21BB</div><h1>\uD734\uB300\uD3F0\uC744 \uAC00\uB85C\uB85C \uB3CC\uB824\uC8FC\uC138\uC694</h1><p>\uB113\uC740 \uD654\uBA74\uC5D0\uC11C \uB450 \uC190\uC73C\uB85C \uC870\uC791\uD560 \uC218 \uC788\uC5B4\uC694.</p><button type="button">\uAC00\uB85C \uD654\uBA74\uC73C\uB85C \uC2DC\uC791</button><p class="rotate-hint" role="status">\uC790\uB3D9 \uD68C\uC804\uC774 \uC548 \uB418\uBA74 \uD734\uB300\uD3F0\uC758 \uD68C\uC804 \uC7A0\uAE08\uC744 \uD480\uACE0 \uC9C1\uC811 \uB3CC\uB824\uC8FC\uC138\uC694.<br>\uCE74\uCE74\uC624\uD1A1 \uC548\uC5D0\uC11C\uB294 \uBA54\uB274\uC5D0\uC11C \uC678\uBD80 \uBE0C\uB77C\uC6B0\uC800\uB85C \uC5F4\uC5B4\uBCF4\uC138\uC694.</p></div>';
rotate.querySelector("button").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    if (screen.orientation?.lock) await screen.orientation.lock("landscape");
  } catch {
  }
  refresh();
});
document.body.append(rotate);
var stick = document.getElementById("mobileStick");
var actions = document.getElementById("mobileActions");
var held = /* @__PURE__ */ new Map();
var stickPointer = null;
var mode = "";
var playing = false;
var language = "";
var deckHeight = 0;
var thumb = document.getElementById("mobileThumb");
var key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true, cancelable: true }));
function hold(owner, codes) {
  const before = new Set([...held.values()].flat());
  if (codes.length) held.set(owner, codes);
  else held.delete(owner);
  const after = new Set([...held.values()].flat());
  for (const code of before) if (!after.has(code)) key(code, false);
  for (const code of after) if (!before.has(code)) key(code, true);
  for (const b of actions.querySelectorAll("[data-code]")) b.classList.toggle("held", after.has(b.dataset.code));
}
function resetStick() {
  thumb.style.transform = "translate(0px,0px)";
  stick.classList.remove("active");
}
function release() {
  for (const owner of [...held.keys()]) hold(owner, []);
  stickPointer = null;
  resetStick();
}
function pause() {
  release();
  const active = document.getElementById("rogue") ? document.getElementById("rogueModal")?.hidden : document.getElementById("panel")?.classList.contains("playing");
  playing = false;
  if (active) key("Escape", true);
  key("Escape", false);
}
var labels = {
  rogue: [["Space", "\uC81C\uB3D9 / \uACF5\uACA9", "Brake / Hit"], ["KeyE", "\uC791\uC5C5", "Interact"], ["ShiftLeft", "\uBD80\uC2A4\uD130", "Boost"], ["KeyC", "\uC815\uBC00", "Precision"], ["KeyQ", "\uD574\uC81C / \uC720\uC778", "Unmoor / Lure"], ["KeyF", "\uBCF4\uAE09", "Supplies"], ["KeyR", "\uC7A5\uBE44", "Gear"], ["KeyG", "\uC120\uC7A5 \uAE30\uC220", "Skill"], ["KeyM", "\uD574\uB3C4", "Chart"], ["KeyB", "\uBE4C\uB4DC", "Build"], ["KeyV", "\uD22C\uCC99", "Throw"], ["KeyX", "\uADF8\uBB3C \uC808\uB2E8", "Cut net"], ["KeyT", "\uACAC\uC778", "Tow"], ["KeyH", "\uBCF4\uAE09\uC815 \uB2FB", "Cargo anchor"]],
  story: [["Space", "\uC5ED\uCD94\uC9C4", "Reverse"], ["KeyE", "\uC791\uC5C5", "Interact"], ["ShiftLeft", "\uBD80\uC2A4\uD130", "Boost"], ["KeyC", "\uC815\uBC00", "Precision"], ["KeyQ", "\uBD80\uD45C", "Buoy"], ["KeyF", "\uD604\uC7A5 \uC791\uC5C5", "Work"], ["KeyZ", "\uC904 \uD480\uAE30", "Pay out"], ["KeyX", "\uC904 \uAC10\uAE30", "Reel in"], ["KeyB", "\uBE4C\uB4DC", "Build"], ["KeyG", "\uC6B0\uD68C", "Detour"], ["KeyI", "\uC120\uB0B4", "Interior"], ["KeyR", "\uBB34\uC804", "Radio"], ["KeyM", "\uD574\uB3C4", "Chart"]]
};
function render(next) {
  release();
  mode = next;
  language = document.documentElement.lang;
  actions.replaceChildren();
  pad.classList.remove("expanded");
  for (const [index, [code, ko, en]] of labels[mode].entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.code = code;
    if (["Space", "KeyE"].includes(code)) button.classList.add("mobile-primary");
    if (index >= 3) button.classList.add("mobile-extra");
    const english = document.documentElement.lang === "en";
    button.textContent = english ? en : ko;
    button.setAttribute("aria-label", `${ko} / ${en}`);
    button.addEventListener("pointerdown", (e) => {
      if (!playing) return;
      e.preventDefault();
      button.setPointerCapture(e.pointerId);
      hold(e.pointerId, [code]);
      queueMicrotask(refresh);
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(event, (e) => hold(e.pointerId, []));
    button.addEventListener("click", (e) => {
      if (e.detail === 0 && playing) {
        key(code, true);
        key(code, false);
      }
    });
    actions.append(button);
  }
  const more = document.createElement("button");
  more.id = "mobileMore";
  more.textContent = language === "en" ? "More" : "\uB354 \uBCF4\uAE30";
  more.setAttribute("aria-label", "\uCD94\uAC00 \uC870\uC791 / More controls");
  more.setAttribute("aria-expanded", "false");
  more.addEventListener("click", () => {
    release();
    const expanded = pad.classList.toggle("expanded");
    more.setAttribute("aria-expanded", String(expanded));
    more.textContent = expanded ? language === "en" ? "Close" : "\uC811\uAE30" : language === "en" ? "More" : "\uB354 \uBCF4\uAE30";
    refresh();
  });
  actions.insertBefore(more, actions.children[3] || null);
}
function move(e) {
  const r = stick.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
  const radius = Math.max(1, Math.hypot(x, y));
  thumb.style.transform = `translate(${x / radius * 28}px,${y / radius * 28}px)`;
  hold("stick", [...x < -0.25 ? ["KeyA"] : x > 0.25 ? ["KeyD"] : [], ...y < -0.25 ? ["KeyW"] : y > 0.25 ? ["KeyS"] : []]);
}
stick.addEventListener("pointerdown", (e) => {
  if (!playing || stickPointer !== null) return;
  e.preventDefault();
  stickPointer = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  stick.classList.add("active");
  move(e);
});
stick.addEventListener("pointermove", (e) => {
  if (e.pointerId === stickPointer) move(e);
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) stick.addEventListener(event, (e) => {
  if (e.pointerId === stickPointer) {
    hold("stick", []);
    stickPointer = null;
    resetStick();
  }
});
var worldTouches = /* @__PURE__ */ new Map();
var gestureWasMulti = false;
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch" || e.target.id !== "rogueSea" || !playing) return;
  if (!worldTouches.size) gestureWasMulti = false;
  worldTouches.set(e.pointerId, { x: e.clientX, y: e.clientY, at: performance.now() });
  if (worldTouches.size > 1) gestureWasMulti = true;
}, true);
document.addEventListener("pointerup", (e) => {
  const start = worldTouches.get(e.pointerId);
  worldTouches.delete(e.pointerId);
  if (!start || gestureWasMulti || !playing || document.getElementById("rogue")?.dataset.mobileMap === "true") return;
  if (performance.now() - start.at < 350 && Math.hypot(start.x - e.clientX, start.y - e.clientY) < 12) {
    document.getElementById("rogueSea")?.dispatchEvent(new PointerEvent("pointerdown", { pointerType: "mouse", button: 0, clientX: e.clientX, clientY: e.clientY, bubbles: true }));
  }
}, true);
document.addEventListener("pointercancel", (e) => {
  worldTouches.delete(e.pointerId);
  gestureWasMulti = true;
}, true);
function installHelp() {
  for (const body of document.querySelectorAll(".session-pause .session-body")) {
    if (body.querySelector(".mobile-help")) continue;
    const help = document.createElement("details");
    help.className = "mobile-help";
    help.open = true;
    help.innerHTML = language === "en" ? "<summary>Touch controls</summary><p>Drag the left pad to steer. Release it to drift. Hold Brake to slow down; Precision alone does not brake. Use both thumbs to steer while braking or boosting.</p><p>Interact handles mooring, boarding and hooks. Hold Supplies or Gear to search. More reveals tow, anchor, build and net actions. Ashore, Brake becomes Attack. Tap the world to aim a throw; use two fingers to zoom. Pausing saves your run.</p>" : "<summary>\uD130\uCE58 \uC870\uC791</summary><p>\uC67C\uCABD \uD328\uB4DC\uB97C \uBC00\uC5B4 \uC870\uD0C0\uD569\uB2C8\uB2E4. \uC190\uC744 \uB193\uC73C\uBA74 \uD45C\uB958\uD569\uB2C8\uB2E4. \uC81C\uB3D9\uC740 \uAE38\uAC8C \uB204\uB974\uC138\uC694. \uC815\uBC00 \uC6B4\uD56D\uB9CC\uC73C\uB85C\uB294 \uBA48\uCD94\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB450 \uC190\uAC00\uB77D\uC73C\uB85C \uC774\uB3D9\uACFC \uC81C\uB3D9\xB7\uBD80\uC2A4\uD130\uB97C \uD568\uAED8 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.</p><p>\uC791\uC5C5\uC73C\uB85C \uACC4\uB958\xB7\uC2B9\uD558\uC120\xB7\uACE0\uB9AC\uB97C \uC870\uC791\uD569\uB2C8\uB2E4. \uBCF4\uAE09\xB7\uC7A5\uBE44\uB294 \uAE38\uAC8C \uB20C\uB7EC \uC218\uC0C9\uD569\uB2C8\uB2E4. \uB354 \uBCF4\uAE30\uC5D0\uC11C \uACAC\uC778\xB7\uB2FB\xB7\uBE4C\uB4DC\xB7\uADF8\uBB3C \uC870\uC791\uC744 \uCC3E\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC0C1\uB959\uD558\uBA74 \uC81C\uB3D9 \uBC84\uD2BC\uC774 \uACF5\uACA9\uC73C\uB85C \uBC14\uB01D\uB2C8\uB2E4. \uD654\uBA74\uC744 \uC9E7\uAC8C \uD130\uCE58\uD574 \uD22C\uCC99 \uBC29\uD5A5\uC744 \uC815\uD558\uACE0 \uB450 \uC190\uAC00\uB77D\uC73C\uB85C \uD655\uB300\uD569\uB2C8\uB2E4. \uC77C\uC2DC\uC815\uC9C0\uD558\uBA74 \uC800\uC7A5\uB429\uB2C8\uB2E4.</p>";
    body.prepend(help);
  }
}
function refresh() {
  const rogue = document.getElementById("rogue");
  const next = rogue ? "rogue" : "story";
  const active = rogue ? document.getElementById("rogueModal")?.hidden : document.getElementById("panel")?.classList.contains("playing");
  const landscape = innerWidth > innerHeight;
  if (mode !== next || language !== document.documentElement.lang) render(next);
  if (playing && (!active || !landscape)) release();
  if (playing && !landscape) pause();
  playing = !!active && landscape;
  pad.hidden = !playing;
  document.body.classList.toggle("mobile-playing", playing);
  const height = playing ? 104 : 0;
  if (deckHeight !== height) {
    deckHeight = height;
    document.documentElement.style.setProperty("--mobile-deck", height + "px");
    window.dispatchEvent(new Event("mobile-layout"));
  }
  if (rogue) {
    const attack = actions.querySelector('[data-code="Space"]');
    if (attack) attack.textContent = rogue.dataset.mobileMode === "ashore" ? language === "en" ? "Attack" : "\uACF5\uACA9" : language === "en" ? "Brake" : "\uC81C\uB3D9";
    const skill = actions.querySelector('[data-code="KeyG"]'), source = document.getElementById("rogueSkill");
    if (skill && source) {
      skill.title = source.title;
      skill.dataset.ready = String(source.getAttribute("aria-disabled") !== "true");
    }
  }
  for (const button of document.querySelectorAll("#playPause,#roguePause")) button.textContent = language === "en" ? "Pause" : "\uC77C\uC2DC\uC815\uC9C0";
  installHelp();
}
setInterval(refresh, 100);
refresh();
window.addEventListener("blur", release, { capture: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) release();
}, { capture: true });
function viewportChanged() {
  document.documentElement.style.setProperty("--mobile-height", `${Math.round(window.visualViewport?.height || innerHeight)}px`);
  if (innerWidth <= innerHeight) pause();
  refresh();
  window.dispatchEvent(new Event("mobile-layout"));
}
window.addEventListener("resize", viewportChanged);
window.visualViewport?.addEventListener("resize", viewportChanged);
viewportChanged();
if (Capacitor.isNativePlatform()) {
  App.addListener("pause", pause);
  App.addListener("appStateChange", ({ isActive }) => {
    if (!isActive) pause();
  });
  App.addListener("backButton", () => {
    release();
    if (playing) {
      pause();
      return;
    }
    const back = document.querySelector("#rogueContinue,#continue,#back,#rogueHome,#interiorBack");
    back?.click();
  });
}
/*! For license information please see mobile.js.LEGAL.txt */
