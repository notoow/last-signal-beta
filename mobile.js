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

// src/steering-input.js
var zero = () => ({ x: 0, y: 0 });
function joystickVector(x, y, deadzone = 0.18) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return zero();
  const length = Math.hypot(x, y);
  if (length <= deadzone) return zero();
  const strength = Math.min(1, (length - deadzone) / (1 - deadzone));
  return { x: x / length * strength, y: y / length * strength };
}

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

// mobile/touch-text.js
function storyTouchText(value) {
  const en = globalThis.document?.documentElement.lang === "en";
  return touchText(String(value).replace(/\bQ\b/g, en ? "Buoy" : "\uBD80\uD45C").replace(/\bEsc\b/g, en ? "Pause" : "\uC77C\uC2DC\uC815\uC9C0"));
}
function touchText(value, language2 = globalThis.document?.documentElement.lang || "ko") {
  const en = language2 === "en";
  const names = en ? { WASD: "Move pad", Space: "Brake", Shift: "Boost", E: "Interact", Q: "Unmoor / Lure", F: "Supplies", R: "Gear", B: "Ship device", G: "Skill", T: "Tow", H: "Cargo anchor", V: "Throw", X: "Cut net", M: "Chart", C: "Precision" } : { WASD: "\uC774\uB3D9 \uD328\uB4DC", Space: "\uC81C\uB3D9", Shift: "\uBD80\uC2A4\uD130", E: "\uC791\uC5C5", Q: "\uD574\uC81C / \uC720\uC778", F: "\uBCF4\uAE09", R: "\uC7A5\uBE44", B: "\uC120\uBC15 \uC7A5\uCE58", G: "\uC120\uC7A5 \uAE30\uC220", T: "\uACAC\uC778", H: "\uBCF4\uAE09\uC815 \uB2FB", V: "\uD22C\uCC99", X: "\uADF8\uBB3C \uC808\uB2E8", M: "\uD574\uB3C4", C: "\uC815\uBC00" };
  return String(value).replaceAll("T \uACAC\uC778 / H \uB2FB", "\uACAC\uC778 / \uBCF4\uAE09\uC815 \uB2FB").replaceAll("T \uBD84\uB9AC \xB7 H \uB2FB", "\uACAC\uC778 \uBD84\uB9AC \xB7 \uBCF4\uAE09\uC815 \uB2FB").replaceAll("Space \uADFC\uC811", "\uACF5\uACA9").replaceAll("Space\uB85C \uAC08\uACE0\uB9AC\uB97C", "\uACF5\uACA9\uC73C\uB85C \uAC08\uACE0\uB9AC\uB97C").replaceAll("V\uB098 \uD074\uB9AD\uC73C\uB85C", "\uD654\uBA74 \uD130\uCE58\uB85C").replaceAll("Space Melee", "Attack").replaceAll("Space swings", "Attack swings").replaceAll("V or click", "a world tap").replace(/\b(WASD|Space|Shift|[EQFRBGTHVXMC])\b/g, (key2) => names[key2]).replaceAll("\uBC29\uD5A5\uD0A4", "\uC774\uB3D9 \uD328\uB4DC");
}

// src/world-projection.js
var IDENTITY_PROJECTION = Object.freeze({ xx: 1, xy: 0, yx: 0, yy: 1 });
var HARBOR_PROJECTION = Object.freeze({ xx: 1, xy: -0.6, yx: 156 / 788, yy: 0.4266 });

// src/navigation-map.js
function navigationTransform(width, height, map) {
  const scale = Math.min(width / map.width, height / map.height);
  return { scale, x: (width - map.width * scale) / 2, y: (height - map.height * scale) / 2 };
}
function drawNavigationMap(canvas, map) {
  if (!map || !canvas) return;
  const c = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
  const { scale: s, x: ox, y: oy } = navigationTransform(w, h, map);
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#07151c";
  c.fillRect(0, 0, w, h);
  c.save();
  c.translate(ox, oy);
  c.scale(s, s);
  c.beginPath();
  c.rect(0, 0, map.width, map.height);
  c.clip();
  c.fillStyle = "#15343f";
  c.fillRect(0, 0, map.width, map.height);
  c.fillStyle = "#889b96";
  if (map.tiles?.length && map.cols && map.rows) {
    const tw = map.width / map.cols, th = map.height / map.rows;
    for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) if (map.tiles[y * map.cols + x]) c.fillRect(x * tw, y * th, tw + 0.5, th + 0.5);
  } else for (const p of map.islands || []) c.fillRect(p.x, p.y, p.w, p.h);
  if (map.survey) {
    for (let y = 0; y < Math.ceil(map.height / map.surveyCell); y++) for (let x = 0; x < map.surveyCols; x++) {
      const cell = y * map.surveyCols + x;
      if (map.visible?.[cell] === 1) continue;
      if (map.survey[cell] === 1 && !map.visible) continue;
      c.fillStyle = map.survey[cell] === 1 ? "#07151ca8" : "#07151c";
      c.fillRect(x * map.surveyCell, y * map.surveyCell, map.surveyCell + 0.5, map.surveyCell + 0.5);
    }
  }
  if (map.viewport?.length) {
    c.beginPath();
    map.viewport.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
    c.closePath();
    c.fillStyle = "#d8e9e310";
    c.fill();
    c.strokeStyle = "#e4eee15c";
    c.lineWidth = 1 / s;
    c.stroke();
  }
  const dot = (p, r, color) => {
    c.fillStyle = color;
    c.beginPath();
    c.arc(p.x, p.y, r / s, 0, Math.PI * 2);
    c.fill();
  };
  for (const b of map.berths || []) {
    const memory = map.visible && map.visible[Math.floor(b.y / map.surveyCell) * map.surveyCols + Math.floor(b.x / map.surveyCell)] !== 1;
    dot(b, 3, memory ? "#79847e" : b.claimed ? "#829b95" : "#e6c27b");
  }
  for (const e of map.enemies || []) dot(e, 2.5, e.asleep ? "#b69078" : "#ef8772");
  for (const p of map.stashes || []) {
    c.fillStyle = "#e4d0a0";
    c.fillRect(p.x - 2.5 / s, p.y - 2.5 / s, 5 / s, 5 / s);
  }
  if (map.target) {
    c.strokeStyle = "#f5cd70";
    c.lineWidth = 1.5 / s;
    c.beginPath();
    c.arc(map.target.x, map.target.y, 7 / s, 0, Math.PI * 2);
    c.stroke();
  }
  if (map.rescue) dot(map.rescue, 3.5, "#8ae0c4");
  if (map.boat && Math.hypot(map.boat.x - map.player.x, map.boat.y - map.player.y) > 4) {
    c.strokeStyle = "#9ddcea";
    c.lineWidth = 2 / s;
    c.strokeRect(map.boat.x - 3 / s, map.boat.y - 3 / s, 6 / s, 6 / s);
  }
  c.translate(map.player.x, map.player.y);
  c.rotate(map.player.angle || 0);
  c.strokeStyle = "#061217";
  c.lineWidth = 3 / s;
  c.fillStyle = "#fff3ba";
  c.beginPath();
  c.moveTo(8 / s, 0);
  c.lineTo(-6 / s, -5 / s);
  c.lineTo(-3 / s, 0);
  c.lineTo(-6 / s, 5 / s);
  c.closePath();
  c.stroke();
  c.fill();
  c.restore();
}

// mobile/sluice-instrument.js
var esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var tenth = (n) => Math.floor(Math.max(0, n) * 10) / 10;
function instrumentCopy(m, lang = "ko") {
  if (!m) return null;
  const en = lang === "en", unit = en ? "s" : "\uCD08";
  const seconds = m.seconds > 0 && m.seconds < 0.1 ? "<0.1" : tenth(m.seconds).toFixed(1);
  const phases = en ? { open: "Plate open", tracking: "Tracking", locked: "Lane locked", backwash: "Backwash \xB7 reset", opened: "Gate opened", recover: "Resetting" } : { open: "\uC7A0\uAE08\uD310 \uC5F4\uB9BC", tracking: "\uC218\uB85C \uCD94\uC801", locked: "\uC218\uB85C \uACE0\uC815", backwash: "\uC5ED\uB958 \xB7 \uC7AC\uC815\uB82C", opened: "\uC218\uBB38 \uAC1C\uBC29", recover: "\uC7AC\uC815\uBE44" };
  const centre = m.centred ? en ? "\u2713 Centre" : "\u2713 \uC911\uC559" : (m.centreDirection === "up" ? "\u2191 " : "\u2193 ") + (en ? "To centre" : "\uC911\uC559\uC73C\uB85C");
  const heading = (m.aligned ? "\u2713 " : "\u21BB ") + (en ? "Bow \u2192" : "\uC120\uC218 \u2192");
  const line = (en ? "Lane " : "\uC218\uB85C ") + m.lane + " \xB7 " + phases[m.phase] + " " + seconds + unit;
  const hook = m.hooked ? (en ? "Tension " : "\uC7A5\uB825 ") + m.tensionPercent + "%" + (m.phase === "open" ? " \xB7 " + (m.canBurst ? en ? "Release & launch" : "\uC904 \uB193\uACE0 \uBC1C\uC9C4" : en ? "Release mooring" : "\uACC4\uB958 \uBD84\uB9AC") : "") : "";
  const receipts = en ? { slow: "Impact too slow", pier: "Pier hit \xB7 aim at centre", angle: "Side hit \xB7 bow first", closed: "Plate closed \xB7 wait", opened: "Gate opened" } : { slow: "\uCDA9\uB3CC \uC18D\uB3C4 \uBD80\uC871", pier: "\uAD50\uAC01 \uCDA9\uB3CC \xB7 \uC911\uC559\uC73C\uB85C", angle: "\uCE21\uBA74 \uCDA9\uB3CC \xB7 \uC120\uC218\uBD80\uD130", closed: "\uC7A0\uAE08\uD310 \uB2EB\uD798 \xB7 \uB300\uAE30", opened: "\uC218\uBB38 \uAC1C\uBC29" };
  let receipt = m.receipt ? receipts[m.receipt.kind] : "";
  if (m.receipt?.kind === "slow" && m.receipt.impactSpeed !== null) receipt += " \xB7 " + (en ? "impact " : "\uC9C1\uC804 ") + tenth(m.receipt.impactSpeed).toFixed(1) + " < " + m.requiredSpeed;
  if (m.receipt?.kind === "opened") receipt += " " + m.opened + "/" + m.total;
  return { label: en ? "East speed \u2192" : "\uB3D9\uCABD \uC18D\uB3C4 \u2192", minimum: (en ? "min " : "\uCD5C\uC18C ") + m.requiredSpeed + "+", line, centre, heading, hook, receipt };
}
function speedMarkup(m, lang) {
  const c = instrumentCopy(m, lang);
  return `<span class="sluice-speed" data-speed-met="${m.speedMet}" aria-label="${esc(c.label + " " + m.speedDisplay + " \xB7 " + c.minimum)}"><small>${esc(c.label)}</small><span><b>${m.speedDisplay}</b><em>${esc(c.minimum)}</em></span></span>`;
}
function noticeMarkup(m, lang) {
  const c = instrumentCopy(m, lang);
  return `<div class="sluice-phase" data-phase="${m.phase}">${esc(c.line)}</div><div class="sluice-alignment"><i data-met="${m.centred}">${esc(c.centre)}</i><i data-met="${m.aligned}">${esc(c.heading)}</i></div>${c.hook ? `<div class="sluice-hook">${esc(c.hook)}</div>` : ""}${c.receipt ? `<div class="sluice-receipt" role="status">${esc(c.receipt)}</div>` : ""}`;
}

// mobile/hud.js
var paths = {
  "signal-speed": "M3 19a9 9 0 1 1 18 0M12 15l5-7M5 15h2m10 0h2M12 5v2",
  tension: "M2 12h4l2-6 3 12 3-12 3 12 2-6h3",
  hull: "M4 9h16l-3 10H7L4 9Zm4 0V5h8v4M12 2v3",
  crew: "M9 3h6v6H9zM5 21v-6l4-3h6l4 3v6",
  fuel: "M5 4h10v17H5zM7 7h6v5H7zM15 9h3l2 3v6h-2v-4h-3",
  boost: "m14 2-9 12h6l-1 8 9-12h-6l1-8Z",
  ammo: "m5 7 5-4 5 4-5 4-5-4Zm5 4v9m-5-7 5 3 8-5m-13 6 5 4 8-5",
  water: "M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z",
  winch: "M5 4h14v16H5zM8 7h8M8 11h8M8 15h8M2 12h3m14 0h3",
  parts: "m5 3 4 4-2 4-4-2 2-6Zm4 8 10 10 3-3-10-10",
  objective: "m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z",
  brake: "M5 5v14m14-14v14M9 8v8m6-8v8",
  interact: "M12 2v14M8 5h8M5 13H2c1 5 5 8 10 9 5-1 9-4 10-9h-3M8 13l4 4 4-4",
  buoy: "M12 2v10M8 5h8M9 12h6l3 7H6l3-7ZM3 21h18",
  attack: "m5 4 4-2 13 13-4 4L5 4ZM3 21l7-7M3 13l8 8",
  more: "M5 11h1v2H5zm6 0h1v2h-1zm6 0h1v2h-1z",
  info: "M12 10v8m0-13v2M3 12a9 9 0 1 0 18 0 9 9 0 1 0-18 0",
  swap: "M3 7h17l-4-4m4 14H3l4 4M20 7l-4 4M3 17l4-4",
  search: "M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3",
  gear: "M4 20 14 10m-2-7 3 3 3-1 1-3c5 4 1 11-4 9L5 22l-3-3 10-10c-1-2-2-4 0-6Z",
  board: "M3 18h18M6 18V7h12v11M9 7V3h6v4M10 11h4m-4 3h4",
  land: "M3 20h18M5 16V8h7m-3 4 4 4 4-4m-4 4V3",
  sail: "M3 16h16l-3 5H6l-3-5Zm7 0V3l8 9h-8M3 8h4m-2-2 2 2-2 2",
  fire: "M12 2c2 6 7 7 7 13a7 7 0 0 1-14 0c0-3 2-5 4-7 0 3 1 4 2 5 2-4 2-7 1-11Z",
  chart: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"
};
var icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.objective}"/></svg>`;
function buttonFace(button, label, name) {
  button.innerHTML = icon(name) + `<span></span>`;
  button.querySelector("span").textContent = label;
}
function specialButtonFace(button, action, en) {
  if (!button.querySelector(".mobile-build-readout")) button.innerHTML = '<span class="mobile-build-readout"></span><span class="mobile-build-label"></span><span class="mobile-build-meter" role="meter"><i></i><em></em></span><small class="mobile-build-time"></small>';
  const readout = button.querySelector(".mobile-build-readout");
  if (button.dataset.build !== action.build) {
    readout.innerHTML = icon(action.build === "bilge" ? "water" : "winch") + "<b></b>";
    button.dataset.build = action.build;
  }
  const m = action.meter, value = Math.max(0, Math.min(m.max, m.value)), meter = button.querySelector(".mobile-build-meter");
  readout.querySelector("b").textContent = Math.floor(value);
  button.querySelector(".mobile-build-label").textContent = en ? action.labelEn : action.labelKo;
  meter.setAttribute("aria-label", en ? m.labelEn : m.labelKo);
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", String(m.max));
  meter.setAttribute("aria-valuenow", String(value));
  const threshold = Number.isFinite(m.threshold), mark = meter.querySelector("em");
  meter.querySelector("i").style.width = value / m.max * 100 + "%";
  mark.hidden = !threshold;
  if (threshold) mark.style.left = m.threshold / m.max * 100 + "%";
  else mark.style.removeProperty("left");
  const stored = Math.max(0, action.storedSeconds || 0), cooldown = Math.max(0, action.cooldown || 0);
  button.querySelector(".mobile-build-time").textContent = stored > 0 ? "\u25F7 " + stored.toFixed(1) + (en ? "s" : "\uCD08") : cooldown > 0 ? "\u21BB " + cooldown.toFixed(1) + (en ? "s" : "\uCD08") : threshold ? "\u2265 " + m.threshold : en ? "No rig" : "\uBBF8\uC7A5\uCC29";
  const time = stored > 0 ? (en ? "Stored time " : "\uC800\uC7A5 \uC2DC\uAC04 ") + stored.toFixed(1) + (en ? " seconds" : "\uCD08") : cooldown > 0 ? (en ? "Cooldown " : "\uC7AC\uC0AC\uC6A9 ") + cooldown.toFixed(1) + (en ? " seconds" : "\uCD08") : "";
  const detail = (en ? action.detailEn : action.detailKo).replace(/\bM (Chart|해도)/g, "$1");
  button.setAttribute("aria-label", [en ? action.labelEn : action.labelKo, (en ? m.labelEn : m.labelKo) + " " + Math.floor(value) + " / " + m.max, detail, time].filter(Boolean).join(" \xB7 "));
  button.title = detail;
  button.dataset.phase = action.phase;
}
var escape2 = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var text = (el) => el?.textContent.trim() || "";
var set = (el, html) => {
  if (el.innerHTML !== html) el.innerHTML = html;
  el.hidden = !html;
};
function createMobileHud({ onMap = () => {
} } = {}) {
  const root = document.createElement("div");
  root.id = "mobileFlightHud";
  root.hidden = true;
  root.innerHTML = '<div id="mobileObjective"></div><div id="mobileResources"></div><div id="mobileVitals"></div><div id="mobileNotice"></div><div id="mobileContext"></div><div id="mobileBuildStatus"></div><div id="mobileBossEncounter"></div>';
  document.body.append(root);
  const nodes = Object.fromEntries([...root.children].map((el) => [el.id, el]));
  nodes.mobileBuildStatus.setAttribute("role", "status");
  const measure = document.createElement("canvas").getContext("2d");
  const mini = document.createElement("button");
  mini.id = "mobileMinimap";
  mini.type = "button";
  mini.innerHTML = '<canvas width="224" height="128" aria-hidden="true"></canvas><span id="mobileClock" hidden></span><span id="mobileRescueMarker" hidden aria-hidden="true">' + icon("crew") + "</span>" + icon("chart");
  mini.addEventListener("click", onMap);
  mini.hidden = true;
  root.append(mini);
  const rescueMarker = mini.querySelector("#mobileRescueMarker");
  let lastMap = null;
  const localKinds = /* @__PURE__ */ new Set(["bilge-jet", "winch-pull", "winch-launch", "line-launch", "brake-launch"]);
  const receivedFrames = /* @__PURE__ */ new WeakMap();
  window.addEventListener("lastsignal:mobile-frame", (event) => {
    if (event.detail?.game === "rogue") receivedFrames.set(event.detail, performance.now());
  });
  let controlToken = null, controlDeadline = 0, controlBlocked = false, controlTimer = 0, lastPresentation = null, frameAt = 0, statusMarkup = "";
  function clearControl() {
    clearTimeout(controlTimer);
    for (const el of document.querySelectorAll("#mobileActions [data-rig-control-id]")) delete el.dataset.rigControlId;
    const status = nodes.mobileBuildStatus;
    if (status.dataset.rigControlId) {
      status.replaceChildren();
      statusMarkup = "";
      status.title = "";
      delete status.dataset.rigControlId;
      status.classList.remove("rig-receipt", "rig-control-receipt");
    }
  }
  window.addEventListener("lastsignal:input-reset", () => {
    controlBlocked = true;
    clearControl();
  });
  const reward = document.createElement("div");
  reward.id = "mobileReward";
  reward.hidden = true;
  reward.setAttribute("role", "status");
  root.append(reward);
  let rewardUntil = 0;
  window.addEventListener("lastsignal:mobile-reward", (event) => {
    const data = event.detail;
    if (!data) return;
    reward.replaceChildren();
    const img = document.createElement("img");
    img.src = data.image;
    img.alt = "";
    const copy = document.createElement("span"), name = document.createElement("b"), rank = document.createElement("small");
    name.textContent = data.name;
    rank.textContent = (document.documentElement.lang === "en" ? "Crew equipped \xB7 rank " : "\uC120\uC6D0 \uC7A5\uCC29 \xB7 ") + data.rank + (document.documentElement.lang === "en" ? "" : "\uB2E8\uACC4");
    copy.append(name, rank);
    reward.append(img, copy);
    rewardUntil = performance.now() + 1500;
  });
  function drawMinimap(m) {
    if (!m || m === lastMap) return;
    lastMap = m;
    const canvas = mini.querySelector("canvas"), w = canvas.width, h = canvas.height, { scale: s, x: ox, y: oy } = navigationTransform(w, h, m);
    rescueMarker.hidden = !m.rescue;
    if (m.rescue) {
      rescueMarker.style.left = (ox + m.rescue.x * s) / w * 100 + "%";
      rescueMarker.style.top = (oy + m.rescue.y * s) / h * 100 + "%";
      rescueMarker.dataset.stage = m.rescue.stage;
      rescueMarker.dataset.blocked = String(!!m.rescue.blocked);
    } else {
      rescueMarker.removeAttribute("style");
      delete rescueMarker.dataset.stage;
      delete rescueMarker.dataset.blocked;
    }
    drawNavigationMap(canvas, m);
  }
  return function refresh2(active, rogue, presentation = null) {
    const now = performance.now(), expanded = document.getElementById("mobileControls")?.classList.contains("expanded");
    if (presentation !== lastPresentation) {
      lastPresentation = presentation;
      frameAt = receivedFrames.get(presentation) ?? now;
    }
    const control = presentation?.rigControl;
    if (control) {
      const token = control.id + ":" + control.kind + ":" + control.code, deadline = frameAt + Math.max(0, Math.min(0.8, control.life) - control.age) * 1e3;
      if (token !== controlToken) {
        controlToken = token;
        controlDeadline = deadline;
        controlBlocked = false;
      } else controlDeadline = Math.min(controlDeadline, deadline);
      if (!active || expanded || presentation.active === false || presentation.mapOpen || rogue?.dataset.mobileMode !== "sailing") controlBlocked = true;
    } else {
      controlToken = null;
      controlDeadline = 0;
      controlBlocked = false;
    }
    clearTimeout(controlTimer);
    root.hidden = !active;
    if (!active) {
      clearControl();
      return;
    }
    reward.hidden = performance.now() > rewardUntil;
    root.classList.toggle("has-reward", !reward.hidden);
    mini.hidden = !presentation?.minimap;
    const english = document.documentElement.lang === "en", rescue = presentation?.minimap?.rescue, rescueLabel = rescue ? (english ? " \xB7 Mechanic: " : " \xB7 \uC815\uBE44\uACF5: ") + (rescue.blocked ? english ? "stopped" : "\uBA48\uCDA4" : rescue.stage === "following" ? english ? "following" : "\uB530\uB77C\uC624\uB294 \uC911" : english ? "waiting" : "\uAE30\uB2E4\uB9AC\uB294 \uC911") : "";
    mini.setAttribute("aria-label", (english ? "Expand explored chart" : "\uD0D0\uC0AC\uD55C \uD574\uB3C4 \uD655\uB300") + rescueLabel);
    if (!mini.hidden) drawMinimap(presentation.minimap);
    else rescueMarker.hidden = true;
    const en = document.documentElement.lang === "en", source = rogue ? document.getElementById("rogueMission") : document.querySelector("#hud .mission-objective");
    const encounter = rogue && !presentation?.mapOpen ? source?.querySelector(".boss-encounter") : null;
    const showEncounter = expanded && encounter?.dataset.kind ? null : encounter;
    set(nodes.mobileBossEncounter, showEncounter?.outerHTML || "");
    nodes.mobileBossEncounter.hidden = !showEncounter;
    root.toggleAttribute("data-boss-encounter", !!showEncounter);
    if (showEncounter?.dataset.kind) root.dataset.bossKind = showEncounter.dataset.kind;
    else delete root.dataset.bossKind;
    const special = presentation?.context?.special, actions2 = document.getElementById("mobileActions");
    const sky = source?.querySelector(".rogue-clock"), clock = mini.querySelector("#mobileClock");
    clock.hidden = !sky;
    clock.textContent = text(sky);
    clock.setAttribute("aria-label", sky?.getAttribute("aria-label") || "");
    const goal = text(source?.querySelector("strong")) || text(source), region = text(source?.querySelector("small")).replace(text(sky), "").trim();
    set(nodes.mobileObjective, icon("objective") + `<div>${region ? `<small>${escape2(region)}</small>` : ""}<strong>${escape2(goal)}</strong></div>`);
    const metrics = rogue ? [...document.querySelectorAll("[data-rogue-metric]")].map((el) => {
      const g = el.querySelector("[role=meter]");
      return { id: el.dataset.rogueMetric, label: text(el.querySelector("span")), value: text(el.querySelector("b")), raw: g?.getAttribute("aria-valuenow"), max: g?.getAttribute("aria-valuemax"), impact: el.dataset.impact === "true" };
    }) : [...document.querySelectorAll("#hud [data-hud-metric]")].map((el) => {
      const g = el.querySelector("[role=meter]");
      return { id: el.dataset.hudMetric, label: text(el.querySelector("span")), value: text(el.querySelector("strong")), raw: g?.getAttribute("aria-valuenow"), max: g?.getAttribute("aria-valuemax"), impact: el.dataset.tone === "danger" };
    });
    if (!rogue && !metrics.length) for (const [i, el] of [...document.querySelectorAll("#hud .meter")].entries()) {
      const g = el.querySelector("progress");
      metrics.push({ id: i ? "boost" : "hull", label: en ? i ? "Energy" : "Hull" : i ? "\uC5D0\uB108\uC9C0" : "\uC120\uCCB4", value: text(el.querySelector("b")).split("/")[0].trim(), raw: g?.value, max: g?.max });
    }
    const vital = (m) => {
      const ratio = Math.max(0, Math.min(1, Number(m.raw ?? m.value) / (Number(m.max) || 100))), danger = m.impact || ratio < 0.25;
      return `<div class="flight-vital ${m.id} ${danger ? "danger" : ""}" role="meter" aria-label="${escape2(m.label)}" aria-valuemin="0" aria-valuemax="${escape2(m.max || 100)}" aria-valuenow="${escape2(m.raw ?? m.value)}">${icon(m.id)}<div><div class="flight-vital-label"><span>${escape2(m.label)}</span><b>${escape2(m.value)}<small> / ${escape2(m.max || 100)}</small></b></div><i><em style="width:${ratio * 100}%"></em></i></div></div>`;
    };
    set(nodes.mobileVitals, metrics.filter((m) => ["hull", "crew", "fuel"].includes(m.id)).map(vital).join(""));
    const layout = rogue && metrics.some((m) => m.id === "hull") && metrics.some((m) => m.id === "fuel") && !metrics.some((m) => m.id === "crew") ? "aboard" : "default";
    if (nodes.mobileVitals.dataset.layout !== layout) nodes.mobileVitals.dataset.layout = layout;
    const sluice = rogue && presentation?.active && !presentation.mapOpen ? presentation.sluice : null;
    nodes.mobileNotice.toggleAttribute("data-sluice", !!sluice);
    root.toggleAttribute("data-sluice-expanded", !!sluice && !!expanded);
    set(nodes.mobileResources, metrics.filter((m) => !["hull", "crew", "fuel"].includes(m.id) && !(sluice?.hooked && m.id === "tension")).map((m) => sluice && m.id === "east-speed" ? speedMarkup(sluice, en ? "en" : "ko") : `<span data-resource="${escape2(m.id)}" class="flight-resource ${m.impact ? "danger" : ""}" aria-label="${escape2(m.label + " " + m.value)}" title="${escape2(m.label)}">${icon(m.id)}<b>${escape2(m.value)}</b></span>`).join(""));
    const notices = rogue ? [...document.querySelectorAll("#rogueConditions>[data-tone=warning],#rogueConditions>[data-rogue-condition=dredger-hit],#rogueConditions>.rogue-impact[data-impact-id],#rogueMission .rogue-boss-state")] : [...document.querySelectorAll("#hud .compact-risks>*,#hud .compact-environment>[data-tone=warning]")];
    set(nodes.mobileNotice, (sluice ? noticeMarkup(sluice, en ? "en" : "ko") : "") + notices.filter((el) => (!encounter || !el.matches(".rogue-boss-state")) && (!sluice || !el.matches(".rogue-boss-state,[data-rogue-condition=sluice-heading],[data-rogue-condition=sluice-impact]"))).map((el) => `<span>${escape2(el.matches(".rogue-impact") ? [...el.children].map(text).filter(Boolean).join(" \xB7 ") : text(el))}</span>`).join(""));
    const work = document.querySelector(rogue ? "#rogueControls .rogue-work" : "#hud .compact-work"), progress = work?.querySelector("progress");
    const context = rogue ? [...document.querySelectorAll("#rogueControls [data-rogue-context]:not([data-rogue-context=camp])")].map(text) : [...document.querySelectorAll("#hud .compact-actions [data-hud-item=context],#hud .anchor-state")].map(text);
    if (rogue && rogue.dataset.mobileMode !== "sailing") context.unshift(text(document.querySelector("#rogueControls [data-rogue-action=primary]")));
    const dock = document.querySelector("#rogueControls .rogue-dock-checks");
    const checks = dock && getComputedStyle(dock).clipPath === "none" ? [...dock.children].map((el) => `<i class="${el.dataset.ok === "true" ? "ready" : ""}">${escape2(text(el))}</i>`).join("") : "";
    const label = rogue ? "" : text(work) || context.filter(Boolean).join(" \xB7 ");
    set(nodes.mobileContext, (checks ? `<div class="flight-dock">${checks}</div>` : "") + (label ? `<span>${escape2(label)}</span>` : "") + (!rogue && progress ? `<progress max="${progress.max}" value="${progress.value}" aria-label="${escape2(label)}"></progress>` : ""));
    const status = nodes.mobileBuildStatus, sailing = rogue && rogue.dataset.mobileMode === "sailing";
    status.hidden = !sailing;
    if (sailing && actions2) {
      const local = control && !controlBlocked && now < controlDeadline ? control : null;
      const button = local ? actions2.querySelector(local.code === "Shift" ? ':scope>[data-code="ShiftLeft"]' : ':scope>.mobile-special[data-code="KeyB"]') : null;
      for (const el of actions2.querySelectorAll("[data-rig-control-id]")) if (el !== button) delete el.dataset.rigControlId;
      if (button) {
        if (button.dataset.rigControlId !== String(local.id)) button.dataset.rigControlId = local.id;
        controlTimer = setTimeout(clearControl, Math.max(0, controlDeadline - performance.now()));
      }
      const r = actions2.getBoundingClientRect();
      status.style.left = r.left + "px";
      status.style.width = r.width + "px";
      status.style.bottom = innerHeight - r.top + 5 + "px";
      const inset = button ? Math.max(0, button.getBoundingClientRect().left - r.left) : 0;
      status.style.setProperty("--rig-receipt-inset", inset + "px");
      const box = status.getBoundingClientRect();
      const unsafe = [nodes.mobileNotice, nodes.mobileVitals, nodes.mobileResources, nodes.mobileObjective, nodes.mobileContext, mini, document.getElementById("rogueSkill"), document.getElementById("mobileTools"), document.getElementById("mobileTransit"), document.getElementById("rogueQuayAssets"), ...actions2.querySelectorAll(".mobile-captain-skill,.mobile-captain-timer")].some((el) => {
        if (!el || getComputedStyle(el).visibility === "hidden") return false;
        const b = el.getBoundingClientRect(), pad2 = el.classList.contains("mobile-captain-skill") ? 4 : 0;
        return b.width && b.height && box.left < b.right + pad2 && box.right > b.left - pad2 && box.top < b.bottom + pad2 && box.bottom > b.top - pad2;
      });
      const clearRow = !expanded && !unsafe && presentation?.active !== false;
      const receipt = clearRow ? button ? local : !localKinds.has(presentation?.rigAction?.kind) ? presentation?.rigAction : null : null;
      let copy = receipt?.text || (clearRow && special && (!special.enabled || special.cooldown > 0) ? en ? special.detailEn : special.detailKo : "");
      const isLocal = !!receipt && receipt === local;
      if (receipt) {
        measure.font = getComputedStyle(status).font;
        const width = r.width - (isLocal ? 20 + inset : 0);
        if (measure.measureText(copy).width > width) copy = receipt.shortText;
        if (measure.measureText(copy).width > width) copy = "";
      }
      const html = isLocal && copy ? icon(local.icon) + `<span>${escape2(copy)}</span>` : escape2(copy);
      if (statusMarkup !== html) {
        status.innerHTML = html;
        statusMarkup = html;
      }
      status.title = copy;
      status.classList.toggle("rig-receipt", !!receipt && !!copy);
      status.classList.toggle("rig-control-receipt", isLocal && !!copy);
      if (isLocal && copy) {
        if (status.dataset.rigControlId !== String(receipt.id)) status.dataset.rigControlId = receipt.id;
      } else delete status.dataset.rigControlId;
      if (receipt && copy && !isLocal) status.dataset.rigActionId = receipt.id;
      else delete status.dataset.rigActionId;
    } else {
      clearControl();
      status.textContent = "";
      statusMarkup = "";
      delete status.dataset.rigActionId;
      status.classList.remove("rig-receipt", "rig-control-receipt");
    }
  };
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
document.documentElement.dataset.mobileUi = "true";
var gameEntry = "./mobile-src/rescue-app.js";
var mobileReady = false;
var pad = document.createElement("nav");
pad.id = "mobileControls";
pad.setAttribute("aria-label", "\uD130\uCE58 \uC870\uC791 / Touch controls");
pad.innerHTML = '<div id="mobileStick" role="group" aria-label="\uC774\uB3D9 / Move"><i id="mobileThumb"></i><span>\uC774\uB3D9</span></div><div id="mobileActions"></div>';
document.body.append(pad);
var rotate = document.createElement("div");
rotate.id = "mobileRotate";
rotate.hidden = innerWidth > innerHeight;
rotate.setAttribute("role", "dialog");
rotate.setAttribute("aria-modal", "true");
rotate.setAttribute("aria-labelledby", "mobileRotateTitle");
rotate.setAttribute("aria-describedby", "mobileRotateDescription");
var rotationInert = /* @__PURE__ */ new Map();
var rotationFocus = null;
var kakao = /KAKAOTALK/i.test(navigator.userAgent) && !Capacitor.isNativePlatform();
function browserHelp(en) {
  const help = document.createElement("div");
  help.className = "mobile-browser-help";
  const external = document.createElement("a");
  external.className = "mobile-external";
  external.textContent = en ? "Open in external browser" : "\uC678\uBD80 \uBE0C\uB77C\uC6B0\uC800\uB85C \uC5F4\uAE30";
  external.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
  external.hidden = !kakao;
  external.addEventListener("click", () => {
    if (mobileReady) pause();
  });
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "mobile-copy-link";
  copy.textContent = en ? "Copy link" : "\uB9C1\uD06C \uBCF5\uC0AC";
  const manual = document.createElement("p");
  manual.className = "mobile-browser-manual";
  manual.textContent = en ? "If nothing opens, use the Kakao menu \u2192 Open in external browser, or paste this link into Chrome / Safari." : "\uC5F4\uB9AC\uC9C0 \uC54A\uC73C\uBA74 \uCE74\uCE74\uC624\uD1A1 \uBA54\uB274 \u2192 \uC678\uBD80 \uBE0C\uB77C\uC6B0\uC800\uB85C \uC5F4\uAE30\uB97C \uB204\uB974\uAC70\uB098, \uB9C1\uD06C\uB97C Chrome / Safari\uC5D0 \uBD99\uC5EC \uB123\uC73C\uC138\uC694.";
  const url = document.createElement("input");
  url.className = "mobile-browser-url";
  url.type = "url";
  url.readOnly = true;
  url.value = location.href;
  url.setAttribute("aria-label", en ? "Game link" : "\uAC8C\uC784 \uB9C1\uD06C");
  url.hidden = true;
  const status = document.createElement("p");
  status.className = "mobile-copy-status";
  status.setAttribute("role", "status");
  copy.addEventListener("click", async () => {
    let copied = false;
    try {
      await navigator.clipboard.writeText(location.href);
      copied = true;
    } catch {
    }
    if (!copied) {
      url.hidden = false;
      url.focus();
      url.select();
      try {
        copied = document.execCommand("copy");
      } catch {
      }
    }
    status.textContent = copied ? en ? "Link copied. Paste it into your browser." : "\uB9C1\uD06C\uB97C \uBCF5\uC0AC\uD588\uC5B4\uC694. \uBE0C\uB77C\uC6B0\uC800 \uC8FC\uC18C\uCC3D\uC5D0 \uBD99\uC5EC \uB123\uC73C\uC138\uC694." : en ? "Select and copy the link below." : "\uC544\uB798 \uB9C1\uD06C\uB97C \uAE38\uAC8C \uB20C\uB7EC \uBCF5\uC0AC\uD574 \uC8FC\uC138\uC694.";
  });
  help.append(external, copy, manual, url, status);
  return help;
}
function renderRotation(en) {
  rotate.replaceChildren();
  const card = document.createElement("div");
  card.className = "rotate-card";
  card.innerHTML = `<small class="rotate-brand">LAST SIGNAL</small><div class="rotate-phone" aria-hidden="true">\u21BB</div><h1 id="mobileRotateTitle">${en ? "Turn your phone sideways" : "\uAC00\uB85C\uB85C \uB3CC\uB824\uC8FC\uC138\uC694"}</h1><p id="mobileRotateDescription">${en ? "Continue in landscape with a wider view." : "\uAC00\uB85C \uD654\uBA74\uC5D0\uC11C \uACC4\uC18D\uD560 \uC218 \uC788\uC5B4\uC694."}</p><button class="mobile-request-landscape" type="button">${en ? "Try fullscreen" : "\uC804\uCCB4\uD654\uBA74 \uC2DC\uB3C4"}</button><p class="rotate-hint" role="status">${en ? "If rotation is locked, unlock it and turn your phone." : "\uD68C\uC804 \uC7A0\uAE08\uC774 \uCF1C\uC838 \uC788\uB2E4\uBA74 \uD574\uC81C\uD558\uACE0 \uC9C1\uC811 \uB3CC\uB824\uC8FC\uC138\uC694."}</p>`;
  if (kakao) card.append(browserHelp(en));
  rotate.append(card);
  card.querySelector("button").addEventListener("click", async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    } catch {
    }
    try {
      if (!screen.orientation?.lock) throw Error("Unsupported");
      await screen.orientation.lock("landscape");
    } catch {
      card.querySelector(".rotate-hint").textContent = en ? "This browser cannot lock rotation. Turn your phone manually or open the link in an external browser." : "\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C\uB294 \uAC00\uB85C \uACE0\uC815\uC744 \uC9C0\uC6D0\uD558\uC9C0 \uC54A\uC744 \uC218 \uC788\uC5B4\uC694. \uC9C1\uC811 \uB3CC\uB9AC\uAC70\uB098 \uC678\uBD80 \uBE0C\uB77C\uC6B0\uC800\uB85C \uC5F4\uC5B4\uC8FC\uC138\uC694.";
    }
    button.disabled = false;
    if (mobileReady) refresh();
    else updateRotation();
  });
}
document.body.append(rotate);
function updateRotation(landscape = innerWidth > innerHeight) {
  const opening = rotate.hidden && !landscape;
  if (opening) rotationFocus = document.activeElement;
  rotate.hidden = landscape;
  if (!landscape) {
    for (const el of document.querySelectorAll("#panel,#rogue,#hud,#space,#playPause,#interiorToggle")) {
      if (!rotationInert.has(el)) rotationInert.set(el, el.inert);
      el.inert = true;
    }
    if (opening) rotate.querySelector("button")?.focus({ preventScroll: true });
  } else {
    for (const [el, inert] of rotationInert) el.inert = inert;
    rotationInert.clear();
    if (rotationFocus?.isConnected && rotationFocus.getClientRects().length && !rotationFocus.closest("[inert]")) rotationFocus.focus({ preventScroll: true });
    rotationFocus = null;
  }
}
renderRotation(document.documentElement.lang === "en");
updateRotation();
var bootRotation = () => {
  if (!mobileReady) updateRotation();
};
window.addEventListener("resize", bootRotation);
await import(gameEntry);
window.removeEventListener("resize", bootRotation);
var refreshFlightHud = createMobileHud({ onMap: () => {
  if (playing) {
    release();
    key("KeyM", true);
    key("KeyM", false);
    refresh();
  }
} });
var stick = document.getElementById("mobileStick");
var actions = document.getElementById("mobileActions");
var held = /* @__PURE__ */ new Map();
var stickPointer = null;
var stickOrigin = null;
var mode = "";
var playing = false;
var language = "";
var deckHeight = 0;
var handledPointers = /* @__PURE__ */ new Set();
var blockedClicks = /* @__PURE__ */ new Map();
var touchClickBound = /* @__PURE__ */ new WeakSet();
var thumb = document.getElementById("mobileThumb");
var voyageNotes = "";
var mobileFrame = null;
var moveSide = "left";
try {
  const saved = JSON.parse(localStorage.getItem("lastsignal.mobile.controls.v1"));
  if (saved?.moveSide === "right") moveSide = "right";
} catch {
}
document.documentElement.dataset.mobileMoveSide = moveSide;
window.addEventListener("lastsignal:mobile-frame", (event) => {
  if (event.detail?.game === mode) {
    mobileFrame = event.detail;
    refresh();
  }
});
function setMoveSide(side) {
  release();
  moveSide = side === "right" ? "right" : "left";
  document.documentElement.dataset.mobileMoveSide = moveSide;
  try {
    localStorage.setItem("lastsignal.mobile.controls.v1", JSON.stringify({ moveSide }));
  } catch {
  }
  document.querySelectorAll("[data-mobile-move-side]").forEach((input) => {
    input.checked = moveSide === "right";
  });
  document.getElementById("mobileSwap")?.setAttribute("aria-pressed", String(moveSide === "right"));
}
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
function steer(vector) {
  window.dispatchEvent(new CustomEvent("lastsignal:steer", { detail: { game: mode, ...vector } }));
}
window.addEventListener("lastsignal:input-reset", (event) => {
  if (event.detail?.game === mode) release();
});
function resetStick() {
  steer({ x: 0, y: 0 });
  thumb.style.transform = "translate(0px,0px)";
  stick.classList.remove("active", "floating");
  stickOrigin = null;
}
function release() {
  clearPinch();
  for (const owner of [...held.keys()]) hold(owner, []);
  const previous = stickPointer;
  stickPointer = null;
  if (previous !== null && stick.hasPointerCapture(previous)) stick.releasePointerCapture(previous);
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
  rogue: [["Space", "\uC81C\uB3D9 / \uACF5\uACA9", "Brake / Hit"], ["KeyE", "\uC791\uC5C5", "Interact"], ["ShiftLeft", "\uBD80\uC2A4\uD130", "Boost"], ["KeyC", "\uC815\uBC00", "Precision"], ["KeyQ", "\uD574\uC81C / \uC720\uC778", "Unmoor / Lure"], ["KeyF", "\uBCF4\uAE09", "Supplies"], ["KeyR", "\uC7A5\uBE44", "Gear"], ["KeyG", "\uC120\uC7A5 \uAE30\uC220", "Skill"], ["KeyM", "\uD574\uB3C4", "Chart"], ["KeyB", "\uC120\uBC15 \uC7A5\uBE44", "Ship gear"], ["KeyV", "\uD22C\uCC99", "Throw"], ["KeyX", "\uADF8\uBB3C \uC808\uB2E8", "Cut net"], ["KeyT", "\uACAC\uC778", "Tow"], ["KeyH", "\uBCF4\uAE09\uC815 \uB2FB", "Cargo anchor"]],
  story: [["Space", "\uC5ED\uCD94\uC9C4", "Reverse"], ["KeyQ", "\uBD80\uD45C", "Buoy"], ["KeyE", "\uC791\uC5C5", "Interact"], ["ShiftLeft", "\uBD80\uC2A4\uD130", "Boost"], ["KeyC", "\uC815\uBC00", "Precision"], ["KeyF", "\uD604\uC7A5 \uC791\uC5C5", "Work"], ["KeyZ", "\uC904 \uD480\uAE30", "Pay out"], ["KeyX", "\uC904 \uAC10\uAE30", "Reel in"], ["KeyB", "\uC120\uBC15 \uC7A5\uBE44", "Ship gear"], ["KeyG", "\uC6B0\uD68C", "Detour"], ["KeyI", "\uC120\uB0B4", "Interior"], ["KeyR", "\uBB34\uC804", "Radio"], ["KeyM", "\uD574\uB3C4", "Chart"]]
};
function installGullHorn() {
  if (mode !== "rogue") return;
  const button = document.createElement("button");
  button.type = "button";
  button.id = "mobileGullHorn";
  button.dataset.code = "KeyQ";
  button.dataset.ready = "false";
  button.hidden = true;
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h5l7-5v14l-7-5H4zM7 14v5h3v-4M19 8q4 4 0 8"/></svg><span></span>';
  bindAction(button);
  actions.append(button);
}
function updateGullHorn(action, en) {
  const button = document.getElementById("mobileGullHorn");
  if (!button) return;
  const ready = action?.id === "horn" && action.enabled && !pad.classList.contains("expanded") && playing;
  button.hidden = !ready;
  button.dataset.ready = String(ready);
  const label = action ? en ? action.labelEn : action.labelKo : en ? "Horn" : "\uACBD\uC801";
  if (button.dataset.label !== label) {
    button.querySelector("span").textContent = label;
    button.dataset.label = label;
    button.setAttribute("aria-label", en ? "Horn \xB7 recover nearby stolen scrap" : "\uACBD\uC801 \xB7 \uAC00\uAE4C\uC6B4 \uAC08\uB9E4\uAE30\uC758 \uACE0\uCCA0 \uD68C\uC218");
  }
}
function render(next) {
  release();
  if (mode !== next) mobileFrame = null;
  mode = next;
  language = document.documentElement.lang;
  pad.dataset.mode = mode;
  renderRotation(language === "en");
  actions.replaceChildren();
  pad.classList.remove("expanded");
  for (const [index, [code, ko, en]] of labels[mode].entries()) {
    if (mode === "rogue" && ["KeyE", "KeyF", "KeyR"].includes(code)) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.code = code;
    if (["Space", "KeyE"].includes(code)) button.classList.add("mobile-primary");
    if (mode === "rogue" && code === "KeyG") button.classList.add("mobile-captain-skill");
    else if (index >= 3) button.classList.add("mobile-extra");
    const english = document.documentElement.lang === "en";
    buttonFace(button, english ? en : ko, code === "Space" ? "brake" : code === "KeyE" ? "interact" : code === "KeyQ" ? "buoy" : code === "ShiftLeft" ? "boost" : "objective");
    button.setAttribute("aria-label", `${ko} / ${en}`);
    bindAction(button);
    actions.append(button);
  }
  const more = document.createElement("button");
  more.id = "mobileMore";
  buttonFace(more, language === "en" ? "More" : "\uB354 \uBCF4\uAE30", "more");
  more.setAttribute("aria-label", "\uCD94\uAC00 \uC870\uC791 / More controls");
  more.setAttribute("aria-expanded", "false");
  bindMenuToggle(more, () => {
    const expanded = pad.classList.toggle("expanded");
    more.setAttribute("aria-expanded", String(expanded));
    buttonFace(more, expanded ? language === "en" ? "Close" : "\uC811\uAE30" : language === "en" ? "More" : "\uB354 \uBCF4\uAE30", "more");
    refresh();
  });
  actions.insertBefore(more, actions.children[3] || null);
  const info = document.createElement("button");
  info.type = "button";
  info.className = "mobile-extra";
  info.id = "mobileInfo";
  buttonFace(info, language === "en" ? "Radio / status" : "\uBB34\uC804\xB7\uC0C1\uD0DC", "info");
  info.addEventListener("click", () => {
    pause();
    refresh();
    document.querySelector(".mobile-notes")?.setAttribute("open", "");
  });
  actions.append(info);
  const swap = document.createElement("button");
  swap.type = "button";
  swap.className = "mobile-extra";
  swap.id = "mobileSwap";
  swap.setAttribute("aria-pressed", String(moveSide === "right"));
  buttonFace(swap, language === "en" ? "Swap hands" : "\uC88C\uC6B0 \uBC18\uC804", "swap");
  swap.addEventListener("click", () => setMoveSide(moveSide === "left" ? "right" : "left"));
  actions.append(swap);
  if (mode === "rogue") for (let i = 0; i < 3; i++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mobile-context-action";
    button.dataset.contextSlot = i;
    button.hidden = true;
    bindAction(button);
    actions.append(button);
  }
  if (mode === "rogue") {
    const supply = document.createElement("div");
    supply.id = "mobileSupply";
    supply.hidden = true;
    supply.setAttribute("role", "group");
    supply.innerHTML = "<strong></strong><small></small><p></p>";
    for (let i = 0; i < 2; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.supplySlot = i;
      bindAction(button);
      supply.append(button);
    }
    actions.append(supply);
    const transit = document.createElement("div");
    transit.id = "mobileTransit";
    transit.hidden = true;
    transit.setAttribute("role", "group");
    transit.setAttribute("aria-label", language === "en" ? "Boarding and departure" : "\uC2B9\uD558\uC120\xB7\uCD9C\uD56D");
    for (let i = 0; i < 3; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.transitSlot = i;
      button.hidden = true;
      bindAction(button);
      transit.append(button);
    }
    const note = document.createElement("small");
    note.id = "mobileTransitNote";
    transit.append(note);
    actions.append(transit);
  }
  const tools = document.createElement("div");
  tools.id = "mobileTools";
  tools.setAttribute("role", "group");
  tools.setAttribute("aria-label", language === "en" ? "Additional controls" : "\uCD94\uAC00 \uC870\uC791");
  for (const button of [...actions.children]) if (button.classList.contains("mobile-extra")) tools.append(button);
  actions.append(tools);
  installGullHorn();
}
function bindMenuToggle(button, toggle) {
  let pointer = null;
  button.addEventListener("pointerdown", (e) => {
    if (!playing || e.button !== 0) return;
    e.preventDefault();
    handledPointers.add(e.pointerId);
    if (pointer !== null) return;
    pointer = e.pointerId;
    button.setPointerCapture(pointer);
  });
  button.addEventListener("pointerup", (e) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    e.preventDefault();
    if (playing) toggle();
  });
  for (const type of ["pointercancel", "lostpointercapture"]) button.addEventListener(type, (e) => {
    if (e.pointerId === pointer) pointer = null;
  });
  button.addEventListener("click", (e) => {
    if (e.detail === 0 && playing) toggle();
  });
}
function bindTouchClick(button, { scrollable = false } = {}) {
  if (touchClickBound.has(button)) return;
  touchClickBound.add(button);
  let pointer = null, start = null, dragged = false;
  button.style.touchAction = scrollable ? "manipulation" : "none";
  button.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch" || e.button !== 0 || button.disabled || button.getAttribute("aria-disabled") === "true") return;
    e.preventDefault();
    handledPointers.add(e.pointerId);
    if (pointer !== null) return;
    pointer = e.pointerId;
    start = { x: e.clientX, y: e.clientY };
    dragged = false;
    button.setPointerCapture(pointer);
  });
  button.addEventListener("pointermove", (e) => {
    if (e.pointerId === pointer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) dragged = true;
  });
  button.addEventListener("pointerup", (e) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    e.preventDefault();
    const r = button.getBoundingClientRect();
    if (!dragged && Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 10 && button.isConnected && !button.disabled && button.getAttribute("aria-disabled") !== "true" && r.width > 0 && r.height > 0 && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) button.click();
  });
  for (const type of ["pointercancel", "lostpointercapture"]) button.addEventListener(type, (e) => {
    if (e.pointerId === pointer) pointer = null;
  });
}
function bindModalTouchClicks(node) {
  if (!(node instanceof Element)) return;
  const bind = (button) => {
    if (button.closest(".rr-view")) return;
    if (button.closest("#panel,#rogueModal,#mobileRotate")) bindTouchClick(button, { scrollable: true });
  };
  if (node.matches("button,summary")) bind(node);
  for (const button of node.querySelectorAll("button,summary")) bind(button);
}
bindModalTouchClicks(document.body);
new MutationObserver((records) => {
  for (const record of records) for (const node of record.addedNodes) bindModalTouchClicks(node);
}).observe(document.body, { childList: true, subtree: true });
function bindAction(button) {
  button.addEventListener("pointerdown", (e) => {
    const code = button.dataset.code;
    if (!playing || !code || button.dataset.ready === "false") return;
    e.preventDefault();
    handledPointers.add(e.pointerId);
    button.setPointerCapture(e.pointerId);
    hold(e.pointerId, [code]);
    queueMicrotask(refresh);
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) button.addEventListener(event, (e) => hold(e.pointerId, []));
  button.addEventListener("click", (e) => {
    const code = button.dataset.code;
    if (e.detail === 0 && playing && code && button.dataset.ready !== "false") {
      key(code, true);
      key(code, false);
    }
  });
}
document.addEventListener("pointerdown", () => blockedClicks.clear(), true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => {
  if (!handledPointers.delete(e.pointerId)) return;
  blockedClicks.set(e.pointerId, { at: performance.now(), x: e.clientX, y: e.clientY });
  for (const [id, p] of blockedClicks) if (performance.now() - p.at > 1e3) blockedClicks.delete(id);
}, true);
document.addEventListener("click", (e) => {
  if (!e.isTrusted) return;
  const now = performance.now(), point = blockedClicks.get(e.pointerId);
  const consumed = point && now - point.at < 1e3 || e.detail > 0 && [...blockedClicks.values()].some((p) => now - p.at < 500 && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 3);
  if (consumed) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);
function refreshContext() {
  const context = mobileFrame?.active ? mobileFrame.context : null, available = [context?.primary, ...context?.secondary || []].filter(Boolean), en = language === "en";
  updateGullHorn(context?.response, en);
  const captain = mobileFrame?.captain, skill = actions.querySelector(".mobile-captain-skill");
  if (skill) {
    const label = captain?.name || (en ? "Captain skill" : "\uC120\uC7A5 \uAE30\uC220"), name = { woo: "hull", park: "boost", han: "buoy", jeong: "winch" }[captain?.id] || "objective";
    if (skill.dataset.label !== label) {
      buttonFace(skill, label, name);
      skill.insertAdjacentHTML("beforeend", '<small class="mobile-captain-timer"></small>');
      skill.dataset.label = label;
    }
    skill.dataset.ready = String(!!captain?.usable);
    skill.setAttribute("aria-disabled", String(!captain?.usable));
    const time = captain?.active ? captain.remaining : captain?.remainingCooldown || 0;
    skill.querySelector("small").textContent = time > 0 ? Math.ceil(time) : "";
    skill.dataset.state = captain?.active ? "active" : time > 0 ? "cooldown" : captain?.usable ? "ready" : "locked";
    skill.style.setProperty("--skill-cooldown", Math.min(1, (captain?.remainingCooldown || 0) / (captain?.cooldown || 1)) * 360 + "deg");
    skill.title = [label, captain?.reason].filter(Boolean).join(" \xB7 ");
    skill.setAttribute("aria-label", skill.title + (time > 0 ? ` \xB7 ${Math.ceil(time)}${en ? " seconds" : "\uCD08"}` : ""));
  }
  const build = actions.querySelector('[data-code="KeyB"]'), special = context?.special;
  actions.dataset.special = String(!!special);
  if (build) {
    if (special) {
      if (build.parentElement !== actions) actions.insertBefore(build, document.getElementById("mobileTools"));
      build.classList.add("mobile-special");
      specialButtonFace(build, special, en);
      build.dataset.ready = String(special.enabled);
      build.setAttribute("aria-disabled", String(!special.enabled));
    } else if (build.classList.contains("mobile-special")) {
      build.classList.remove("mobile-special");
      delete build.dataset.build;
      delete build.dataset.phase;
      delete build.dataset.ready;
      build.removeAttribute("aria-disabled");
      build.removeAttribute("title");
      buttonFace(build, en ? "Ship gear" : "\uC120\uBC15 \uC7A5\uBE44", "objective");
      build.setAttribute("aria-label", "\uC120\uBC15 \uC7A5\uBE44 / Ship gear");
      document.getElementById("mobileTools").append(build);
    }
  }
  actions.dataset.contextCount = available.length;
  actions.dataset.mode = mobileFrame?.mode || "";
  const supply = document.getElementById("mobileSupply"), cargo = context?.supply;
  if (supply) {
    supply.hidden = !cargo;
    if (cargo) {
      supply.setAttribute("aria-label", en ? cargo.titleEn : cargo.titleKo);
      supply.querySelector("strong").textContent = en ? cargo.titleEn : cargo.titleKo;
      supply.querySelector("small").textContent = en ? cargo.rewardEn : cargo.rewardKo;
      supply.querySelector("p").textContent = en ? cargo.hintEn : cargo.hintKo;
      for (const button of supply.querySelectorAll("button")) {
        const a = cargo.actions[Number(button.dataset.supplySlot)], label = en ? a.labelEn : a.labelKo;
        button.textContent = label;
        button.dataset.code = a.code;
        button.dataset.action = a.id;
        button.dataset.ready = String(a.enabled);
        button.disabled = !a.enabled;
        button.setAttribute("aria-disabled", String(!a.enabled));
      }
    }
  }
  const transit = document.getElementById("mobileTransit"), transitActions = context?.transit || [];
  if (transit) {
    transit.hidden = !transitActions.length;
    for (const button of transit.querySelectorAll("button")) {
      const action = transitActions[Number(button.dataset.transitSlot)];
      button.hidden = !action;
      if (!action) {
        delete button.dataset.code;
        button.dataset.ready = "false";
        continue;
      }
      const label = en ? action.labelEn : action.labelKo, code = action.code.replace("Key", ""), name = action.id === "land" ? "land" : action.id === "board" ? "board" : action.id === "rest" ? "fire" : "sail";
      if (button.dataset.action !== action.id || button.dataset.label !== label) {
        buttonFace(button, label, name);
        button.insertAdjacentHTML("beforeend", `<kbd aria-hidden="true">${code}</kbd>`);
        button.dataset.action = action.id;
        button.dataset.label = label;
      }
      button.dataset.code = action.code;
      button.dataset.ready = String(action.enabled);
      button.setAttribute("aria-disabled", String(!action.enabled));
      button.setAttribute("aria-label", `${label} \xB7 ${code}${action.detailKo ? " \xB7 " + (en ? action.detailEn : action.detailKo) : ""}`);
      button.title = button.getAttribute("aria-label");
      button.dataset.state = action.reason || "";
      button.style.setProperty("--camp-progress", Math.max(0, Math.min(1, action.progress || 0)) * 100 + "%");
    }
    const rest = transitActions.find((a) => a.id === "rest"), note = document.getElementById("mobileTransitNote");
    note.hidden = !rest;
    note.textContent = rest ? en ? rest.detailEn : rest.detailKo : "";
  }
  for (const button of actions.querySelectorAll("[data-context-slot]")) {
    const action = available[Number(button.dataset.contextSlot)];
    button.hidden = !action && button.dataset.contextSlot !== "0";
    if (!action) {
      if (!button.hidden) {
        buttonFace(button, en ? "Interact" : "\uC791\uC5C5", "interact");
        button.dataset.ready = "false";
        button.setAttribute("aria-disabled", "true");
        button.setAttribute("aria-label", en ? "Approach a quay or work site" : "\uBD80\uB450\uB098 \uC791\uC5C5 \uB300\uC0C1\uC5D0 \uC811\uADFC\uD558\uC138\uC694");
        delete button.dataset.action;
        delete button.dataset.label;
        delete button.dataset.code;
        button.classList.remove("working");
      }
      continue;
    }
    const label = en ? action.labelEn : action.labelKo, name = action.id === "rescue" ? "crew" : action.id === "scrap" ? "ammo" : action.code === "KeyF" ? "search" : action.code === "KeyR" ? "gear" : action.id === "land" ? "land" : action.id === "board" ? "board" : "interact";
    if (button.dataset.action !== action.id || button.dataset.label !== label) {
      buttonFace(button, label, name);
      button.dataset.label = label;
      button.dataset.action = action.id;
    }
    button.dataset.code = action.code;
    button.dataset.ready = String(action.enabled);
    button.setAttribute("aria-disabled", String(!action.enabled));
    button.dataset.hold = String(!!action.hold);
    button.setAttribute("aria-label", label + (action.hold ? en ? " \xB7 hold" : " \xB7 \uAE38\uAC8C \uB204\uB974\uAE30" : ""));
    button.title = button.getAttribute("aria-label");
    button.style.setProperty("--work-progress", Math.max(0, Math.min(1, action.progress || 0)) * 360 + "deg");
    button.classList.toggle("working", action.progress > 0);
  }
}
function move(e) {
  if (!stickOrigin) return;
  const r = stick.getBoundingClientRect(), x = (e.clientX - stickOrigin.x) / (r.width / 2), y = (e.clientY - stickOrigin.y) / (r.height / 2);
  const radius = Math.max(1, Math.hypot(x, y));
  thumb.style.transform = `translate(${x / radius * 28}px,${y / radius * 28}px)`;
  steer(joystickVector(x, y));
}
var pinchWorld = /* @__PURE__ */ new Map();
var pinchConsumed = /* @__PURE__ */ new Set();
var mobilePinch = null;
var pinchEvent = (phase, scale) => window.dispatchEvent(new CustomEvent("lastsignal:pinch", { detail: { game: "rogue", phase, scale } }));
function clearPinch() {
  if (mobilePinch) pinchEvent("end");
  mobilePinch = null;
  pinchWorld.clear();
  pinchConsumed.clear();
  worldTouches.clear();
  gestureWasMulti = false;
}
document.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch" || mode !== "rogue" || !playing || mobileFrame?.mapOpen || e.target.id !== "rogueSea") return;
  pinchWorld.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinchConsumed.size) {
    pinchConsumed.add(e.pointerId);
    e.target.setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  if (pinchWorld.size !== 2 || held.size) return;
  const points = [...pinchWorld.values()], gap = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  if (gap < 20) return;
  const previous = stickPointer;
  stickPointer = null;
  if (previous !== null && stick.hasPointerCapture(previous)) stick.releasePointerCapture(previous);
  resetStick();
  worldTouches.clear();
  gestureWasMulti = true;
  mobilePinch = { gap, ids: [...pinchWorld.keys()] };
  pinchEvent("start");
  for (const id of mobilePinch.ids) {
    pinchConsumed.add(id);
    document.getElementById("rogueSea").setPointerCapture(id);
  }
  e.preventDefault();
  e.stopImmediatePropagation();
}, true);
document.addEventListener("pointermove", (e) => {
  if (!pinchWorld.has(e.pointerId)) return;
  pinchWorld.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!pinchConsumed.has(e.pointerId)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  if (mobilePinch) {
    const [a, b] = mobilePinch.ids.map((id) => pinchWorld.get(id));
    if (a && b) pinchEvent("move", Math.hypot(a.x - b.x, a.y - b.y) / mobilePinch.gap);
  }
}, true);
for (const type of ["pointerup", "pointercancel"]) document.addEventListener(type, (e) => {
  pinchWorld.delete(e.pointerId);
  if (!pinchConsumed.delete(e.pointerId)) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  blockedClicks.set(e.pointerId, { at: performance.now(), x: e.clientX, y: e.clientY });
  if (mobilePinch) {
    pinchEvent("end");
    mobilePinch = null;
  }
}, true);
document.addEventListener("pointerdown", (e) => {
  const onStick = e.target === stick || stick.contains(e.target), world = ["rogueSea", "space"].includes(e.target.id), side = moveSide === "left" ? e.clientX < innerWidth * 0.44 : e.clientX > innerWidth * 0.56;
  if (!playing || stickPointer !== null || e.button !== 0 || !onStick && !(world && side && e.clientY > Math.max(76, innerHeight * 0.28)) || mobileFrame?.mapOpen) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  stickPointer = e.pointerId;
  stickOrigin = { x: e.clientX, y: e.clientY };
  stick.style.setProperty("--stick-x", e.clientX + "px");
  stick.style.setProperty("--stick-y", e.clientY + "px");
  stick.classList.add("active", "floating");
  stick.setPointerCapture(e.pointerId);
  move(e);
}, true);
document.addEventListener("pointermove", (e) => {
  if (e.pointerId === stickPointer) {
    e.preventDefault();
    e.stopImmediatePropagation();
    move(e);
  }
}, true);
for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) document.addEventListener(event, (e) => {
  if (e.pointerId === stickPointer) {
    e.stopImmediatePropagation();
    hold("stick", []);
    const previous = stickPointer;
    stickPointer = null;
    if (stick.hasPointerCapture(previous)) stick.releasePointerCapture(previous);
    resetStick();
  }
}, true);
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
  for (const section of document.querySelectorAll(".session-pause .session-body")) {
    const body = section.closest(".rp-view") ? section.querySelector(".rp-controls>.rp-detail-content") || section.querySelector(".rp-detail-content") : section;
    if (!body) continue;
    if (body.querySelector(".mobile-help")) continue;
    const help = document.createElement("details");
    help.className = "mobile-help";
    help.open = true;
    help.innerHTML = language === "en" ? "<summary>Touch controls</summary><p>Touch the lower movement side and drag: the pad appears under your thumb. Drag slightly for fine thrust, farther for more thrust. Release to drift; hold Brake to slow down. Swap sides below or from More.</p><p>Nearby mooring, boarding and search actions appear beside Attack. Hold Search until its ring fills. Tap the small chart to expand it. More contains the other tools. Pausing saves your run.</p>" : "<summary>\uD130\uCE58 \uC870\uC791</summary><p>\uC774\uB3D9 \uC190 \uCABD \uC544\uB798 \uC601\uC5ED\uC744 \uB204\uB974\uACE0 \uBC00\uBA74 \uADF8 \uC790\uB9AC\uC5D0 \uD328\uB4DC\uAC00 \uC0DD\uAE41\uB2C8\uB2E4. \uC870\uAE08 \uBC00\uBA74 \uBBF8\uC138 \uCD94\uC9C4, \uB354 \uBC00\uBA74 \uAC15\uD55C \uCD94\uC9C4\uC785\uB2C8\uB2E4. \uC190\uC744 \uB193\uC73C\uBA74 \uD45C\uB958\uD558\uACE0, \uC81C\uB3D9\uC744 \uAE38\uAC8C \uB204\uB974\uBA74 \uAC10\uC18D\uD569\uB2C8\uB2E4. \uC544\uB798 \uC124\uC815\uC774\uB098 \uB354 \uBCF4\uAE30\uC5D0\uC11C \uC88C\uC6B0\uB97C \uBC14\uAFC0 \uC218 \uC788\uC5B4\uC694.</p><p>\uAC00\uAE4C\uC6B4 \uC811\uC548\xB7\uC2B9\uD558\uC120\xB7\uC218\uC0C9 \uBC84\uD2BC\uC740 \uACF5\uACA9 \uC606\uC5D0 \uB098\uD0C0\uB0A9\uB2C8\uB2E4. \uC218\uC0C9\uC740 \uC9C4\uD589 \uB9C1\uC774 \uCC30 \uB54C\uAE4C\uC9C0 \uAE38\uAC8C \uB204\uB974\uC138\uC694. \uC791\uC740 \uD574\uB3C4\uB97C \uB204\uB974\uBA74 \uD655\uB300\uD569\uB2C8\uB2E4. \uB098\uBA38\uC9C0 \uB3C4\uAD6C\uB294 \uB354 \uBCF4\uAE30\uC5D0 \uC788\uACE0 \uC77C\uC2DC\uC815\uC9C0\uD558\uBA74 \uC800\uC7A5\uB429\uB2C8\uB2E4.</p>";
    body.prepend(help);
    if (kakao) body.append(browserHelp(language === "en"));
    if (voyageNotes && !section.closest(".rp-view")) {
      const notes = document.createElement("details");
      notes.className = "mobile-notes";
      const title = document.createElement("summary");
      title.textContent = language === "en" ? "Radio and current status" : "\uBB34\uC804 \uBC0F \uD604\uC7AC \uC0C1\uD0DC";
      const text2 = document.createElement("p");
      text2.textContent = voyageNotes;
      notes.append(title, text2);
      body.prepend(notes);
    }
  }
  for (const section of document.querySelectorAll(".session-pause .session-body,.embark-options")) {
    const parent = section.closest(".rp-view") ? section.querySelector(".rp-controls>.rp-detail-content") || section.querySelector(".rp-detail-content") : section;
    if (!parent) continue;
    if (parent.querySelector("[data-mobile-move-side]")) continue;
    const label = document.createElement("label");
    label.className = "mobile-handedness";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.mobileMoveSide = "";
    input.checked = moveSide === "right";
    input.addEventListener("change", () => setMoveSide(input.checked ? "right" : "left"));
    label.append(input, document.createTextNode(language === "en" ? "Movement on right \xB7 swap hands" : "\uC624\uB978\uC190\uC73C\uB85C \uC774\uB3D9 \xB7 \uC88C\uC6B0 \uBC18\uC804"));
    parent.prepend(label);
  }
}
var preparationDetails = /* @__PURE__ */ new WeakMap();
var preparationTargets = [];
var preparationObserver = new MutationObserver(() => compactPreparation());
function compactPreparation() {
  const targets = [document.getElementById("departureProfile"), document.getElementById("departureBuild")].filter(Boolean);
  if (targets.length !== preparationTargets.length || targets.some((el, i) => el !== preparationTargets[i])) {
    preparationObserver.disconnect();
    preparationTargets = targets;
    for (const el of targets) preparationObserver.observe(el, { childList: true });
  }
  const profile = document.getElementById("departureProfile"), en = language === "en";
  if (profile && !profile.querySelector(".mobile-captain-details")) {
    const details = document.createElement("details");
    details.className = "mobile-captain-details";
    const summary = document.createElement("summary");
    summary.textContent = en ? "Stats & skill" : "\uB2A5\uB825 \uC0C1\uC138";
    details.append(summary);
    details.open = !!preparationDetails.get(profile)?.open;
    for (const el of profile.querySelectorAll(".embark-stats,.embark-skill")) details.append(el);
    profile.append(details);
    preparationDetails.set(profile, details);
  }
  const build = document.getElementById("departureBuild");
  if (build && !build.querySelector(".mobile-build-details")) {
    const details = document.createElement("details");
    details.className = "mobile-build-details";
    const summary = document.createElement("summary");
    summary.textContent = en ? "Handling details" : "\uC6B4\uD56D \uC0C1\uC138";
    details.append(summary);
    details.open = !!preparationDetails.get(build)?.open;
    for (const el of build.querySelectorAll(".embark-build-risk,.embark-key")) {
      el.textContent = touchText(el.textContent, language);
      details.append(el);
    }
    build.append(details);
    preparationDetails.set(build, details);
  }
}
document.addEventListener("click", (event) => {
  const button = event.target.closest?.(".embark-roster [data-captain]");
  if (button?.getAttribute("aria-pressed") === "true") button.focus({ preventScroll: true });
});
function compactHome() {
  const panel = document.querySelector("#panel.cabin-screen"), choices = panel?.querySelector(".title-choices");
  if (!choices || panel.querySelector(".mobile-home-quick")) return;
  const en = language === "en", resume = choices.querySelector("#rogueResume") || choices.querySelector("#resume"), fresh = choices.querySelector("#roguelike");
  if (!fresh) return;
  const main = document.createElement("div");
  main.className = "mobile-home-main";
  if (resume) main.append(resume);
  main.append(fresh);
  const quick = document.createElement("nav");
  quick.className = "mobile-home-quick";
  quick.setAttribute("aria-label", en ? "Harbor menu" : "\uD56D\uAD6C \uBA54\uB274");
  const story = choices.querySelector("#start"), settings = choices.querySelector("#settings");
  if (story) quick.append(story);
  const more = document.createElement("details");
  more.className = "mobile-home-extras";
  const summary = document.createElement("summary");
  summary.textContent = en ? "Harbor" : "\uD56D\uAD6C \uBA54\uB274";
  more.append(summary);
  const extra = document.createElement("div");
  extra.className = "mobile-home-extra-list";
  for (const button of [...choices.querySelectorAll("button")]) if (button !== settings) extra.append(button);
  more.append(extra);
  quick.append(more);
  if (settings) quick.append(settings);
  choices.append(main);
  panel.append(quick);
  const caption = document.createElement("p");
  caption.className = "mobile-home-caption";
  caption.textContent = en ? "The next signal is waiting." : "\uC544\uC9C1, \uB204\uAD70\uAC00\uC758 \uC2E0\uD638\uAC00 \uB0A8\uC544 \uC788\uB2E4.";
  panel.querySelector(".title-mark").append(caption);
}
function refresh() {
  const rogue = document.getElementById("rogue");
  const next = rogue ? "rogue" : "story";
  const active = rogue ? document.getElementById("rogueModal")?.hidden : document.getElementById("panel")?.classList.contains("playing");
  const landscape = innerWidth > innerHeight;
  if (mode !== next || language !== document.documentElement.lang) render(next);
  updateRotation(landscape);
  if (playing && (!active || !landscape)) release();
  if (active && !landscape) pause();
  playing = !!active && landscape;
  if (playing) voyageNotes = [...document.querySelectorAll("#rogueMission,#rogueRadio,#rogueConditions,#rogueControls,#hud .mission-objective,#hud .radio-panel,#hud .compact-conditions,#hud .compact-actions,#hud .passenger-status,#hud .hud-hint")].map((el) => el.textContent.trim()).filter(Boolean).join("\n\n");
  pad.hidden = !playing;
  pad.inert = !playing;
  document.body.classList.toggle("mobile-playing", playing);
  const height = 0;
  if (deckHeight !== height) {
    deckHeight = height;
    document.documentElement.style.setProperty("--mobile-deck", height + "px");
    window.dispatchEvent(new Event("mobile-layout"));
  }
  if (rogue) {
    refreshContext();
    const attack = actions.querySelector('[data-code="Space"]');
    if (attack && attack.dataset.mode !== rogue.dataset.mobileMode) {
      attack.dataset.mode = rogue.dataset.mobileMode;
      buttonFace(attack, rogue.dataset.mobileMode === "ashore" ? language === "en" ? "Attack" : "\uACF5\uACA9" : language === "en" ? "Brake" : "\uC81C\uB3D9", rogue.dataset.mobileMode === "ashore" ? "attack" : "brake");
    }
  }
  for (const button of document.querySelectorAll("#playPause,#roguePause")) {
    button.textContent = "\u2161";
    button.setAttribute("aria-label", language === "en" ? "Pause" : "\uC77C\uC2DC\uC815\uC9C0");
  }
  if (playing && !rogue) for (const section of document.querySelectorAll("#hud .context-action,#hud .compact-actions,#hud .compact-work")) {
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const value = storyTouchText(node.data);
      if (node.data !== value) node.data = value;
    }
  }
  installHelp();
  compactPreparation();
  compactHome();
  refreshFlightHud(playing, rogue, mobileFrame);
  document.getElementById("mobileFlightHud").inert = !playing;
  for (const button of document.querySelectorAll("#mobileMinimap,#roguePause,#playPause,#mobileInfo,#mobileSwap")) bindTouchClick(button);
}
var surfaceObserver = new MutationObserver(() => refresh());
var watchedSurfaces = /* @__PURE__ */ new WeakSet();
function watchSurfaces() {
  for (const el of [document.getElementById("panel"), document.getElementById("rogueModal")]) {
    if (!el || watchedSurfaces.has(el)) continue;
    watchedSurfaces.add(el);
    surfaceObserver.observe(el, { attributes: true, attributeFilter: el.id === "panel" ? ["class"] : ["hidden"] });
  }
}
new MutationObserver(() => {
  watchSurfaces();
  refresh();
}).observe(document.body, { childList: true });
mobileReady = true;
watchSurfaces();
setInterval(() => {
  if (mode !== "rogue" || !playing) refresh();
}, 100);
refresh();
window.addEventListener("blur", (event) => {
  if (event.target === window) release();
}, { capture: true });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) release();
}, { capture: true });
function viewportChanged() {
  release();
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
