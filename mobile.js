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

// mobile/touch-text.js
function storyTouchText(value) {
  const en = globalThis.document?.documentElement.lang === "en";
  return touchText(String(value).replace(/\bQ\b/g, en ? "Buoy" : "\uBD80\uD45C").replace(/\bEsc\b/g, en ? "Pause" : "\uC77C\uC2DC\uC815\uC9C0"));
}
function touchText(value, language2 = globalThis.document?.documentElement.lang || "ko") {
  const en = language2 === "en";
  const names = en ? { WASD: "Move pad", Space: "Brake", Shift: "Boost", E: "Interact", Q: "Unmoor / Lure", F: "Supplies", R: "Gear", B: "Build", G: "Skill", T: "Tow", H: "Cargo anchor", V: "Throw", X: "Cut net", M: "Chart", C: "Precision" } : { WASD: "\uC774\uB3D9 \uD328\uB4DC", Space: "\uC81C\uB3D9", Shift: "\uBD80\uC2A4\uD130", E: "\uC791\uC5C5", Q: "\uD574\uC81C / \uC720\uC778", F: "\uBCF4\uAE09", R: "\uC7A5\uBE44", B: "\uBE4C\uB4DC", G: "\uC120\uC7A5 \uAE30\uC220", T: "\uACAC\uC778", H: "\uBCF4\uAE09\uC815 \uB2FB", V: "\uD22C\uCC99", X: "\uADF8\uBB3C \uC808\uB2E8", M: "\uD574\uB3C4", C: "\uC815\uBC00" };
  return String(value).replaceAll("T \uACAC\uC778 / H \uB2FB", "\uACAC\uC778 / \uBCF4\uAE09\uC815 \uB2FB").replaceAll("T \uBD84\uB9AC \xB7 H \uB2FB", "\uACAC\uC778 \uBD84\uB9AC \xB7 \uBCF4\uAE09\uC815 \uB2FB").replaceAll("Space \uADFC\uC811", "\uACF5\uACA9").replaceAll("Space\uB85C \uAC08\uACE0\uB9AC\uB97C", "\uACF5\uACA9\uC73C\uB85C \uAC08\uACE0\uB9AC\uB97C").replaceAll("V\uB098 \uD074\uB9AD\uC73C\uB85C", "\uD654\uBA74 \uD130\uCE58\uB85C").replaceAll("Space Melee", "Attack").replaceAll("Space swings", "Attack swings").replaceAll("V or click", "a world tap").replace(/\b(WASD|Space|Shift|[EQFRBGTHVXMC])\b/g, (key2) => names[key2]).replaceAll("\uBC29\uD5A5\uD0A4", "\uC774\uB3D9 \uD328\uB4DC");
}

// mobile/hud.js
var paths = {
  hull: "M4 9h16l-3 10H7L4 9Zm4 0V5h8v4M12 2v3",
  crew: "M9 3h6v6H9zM5 21v-6l4-3h6l4 3v6",
  fuel: "M5 4h10v17H5zM7 7h6v5H7zM15 9h3l2 3v6h-2v-4h-3",
  boost: "m14 2-9 12h6l-1 8 9-12h-6l1-8Z",
  ammo: "m5 7 5-4 5 4-5 4-5-4Zm5 4v9m-5-7 5 3 8-5m-13 6 5 4 8-5",
  water: "M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z",
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
  chart: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"
};
var icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${paths[name] || paths.objective}"/></svg>`;
function buttonFace(button, label, name) {
  button.innerHTML = icon(name) + `<span></span>`;
  button.querySelector("span").textContent = label;
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
  root.innerHTML = '<div id="mobileObjective"></div><div id="mobileResources"></div><div id="mobileVitals"></div><div id="mobileNotice"></div><div id="mobileContext"></div>';
  document.body.append(root);
  const nodes = Object.fromEntries([...root.children].map((el) => [el.id, el]));
  const mini = document.createElement("button");
  mini.id = "mobileMinimap";
  mini.type = "button";
  mini.innerHTML = '<canvas width="224" height="128" aria-hidden="true"></canvas>' + icon("chart");
  mini.addEventListener("click", onMap);
  mini.hidden = true;
  root.append(mini);
  let lastMap = null;
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
    const canvas = mini.querySelector("canvas"), c = canvas.getContext("2d"), w = canvas.width, h = canvas.height, s = Math.min(w / m.width, h / m.height), ox = (w - m.width * s) / 2, oy = (h - m.height * s) / 2;
    c.fillStyle = "#081d25";
    c.fillRect(0, 0, w, h);
    c.save();
    c.translate(ox, oy);
    c.scale(s, s);
    c.fillStyle = "#224d55";
    c.fillRect(0, 0, m.width, m.height);
    if (m.tiles?.length && m.cols && m.rows) {
      const tw = m.width / m.cols, th = m.height / m.rows;
      c.fillStyle = "#939381";
      for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) if (m.tiles[y * m.cols + x]) c.fillRect(x * tw, y * th, tw + 0.5, th + 0.5);
    }
    if (m.survey) {
      c.fillStyle = "#08171f";
      const rows = Math.ceil(m.height / m.surveyCell);
      for (let y = 0; y < rows; y++) for (let x = 0; x < m.surveyCols; x++) if (m.survey[y * m.surveyCols + x] !== 1) c.fillRect(x * m.surveyCell, y * m.surveyCell, m.surveyCell + 0.5, m.surveyCell + 0.5);
    }
    const dot = (p, r, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(p.x, p.y, r / s, 0, Math.PI * 2);
      c.fill();
    };
    for (const b of m.berths || []) dot(b, 2.4, b.claimed ? "#9db9af" : "#dfbe78");
    for (const e of m.enemies || []) dot(e, 2, e.asleep ? "#ac8c75" : "#ec896c");
    if (m.boat && Math.hypot(m.boat.x - m.player.x, m.boat.y - m.player.y) > 4) dot(m.boat, 2.5, "#c6e2e6");
    dot(m.player, 4, "#fff1b4");
    c.restore();
  }
  return function refresh2(active, rogue, presentation = null) {
    root.hidden = !active;
    if (!active) return;
    reward.hidden = performance.now() > rewardUntil;
    root.classList.toggle("has-reward", !reward.hidden);
    mini.hidden = !rogue || !presentation?.minimap;
    mini.setAttribute("aria-label", document.documentElement.lang === "en" ? "Expand explored chart" : "\uD0D0\uC0AC\uD55C \uD574\uB3C4 \uD655\uB300");
    if (!mini.hidden) drawMinimap(presentation.minimap);
    const en = document.documentElement.lang === "en", source = rogue ? document.getElementById("rogueMission") : document.querySelector("#hud .mission-objective");
    const goal = text(source?.querySelector("strong")) || text(source), region = text(source?.querySelector("small"));
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
      return `<div class="flight-vital ${m.id} ${danger ? "danger" : ""}" role="meter" aria-label="${escape2(m.label)}" aria-valuemin="0" aria-valuemax="${escape2(m.max || 100)}" aria-valuenow="${escape2(m.raw ?? m.value)}">${icon(m.id)}<div><div class="flight-vital-label"><span>${escape2(m.label)}</span><b>${escape2(m.value)}</b></div><i><em style="width:${ratio * 100}%"></em></i></div></div>`;
    };
    set(nodes.mobileVitals, metrics.filter((m) => ["hull", "crew", "fuel"].includes(m.id)).map(vital).join(""));
    set(nodes.mobileResources, metrics.filter((m) => !["hull", "crew", "fuel"].includes(m.id)).map((m) => `<span class="flight-resource ${m.impact ? "danger" : ""}" aria-label="${escape2(m.label + " " + m.value)}" title="${escape2(m.label)}">${icon(m.id)}<b>${escape2(m.value)}</b></span>`).join(""));
    const notices = rogue ? [...document.querySelectorAll("#rogueConditions>[data-tone=warning],#rogueConditions>.rogue-impact[data-impact-id],#rogueMission .rogue-boss-state")] : [...document.querySelectorAll("#hud .compact-risks>*,#hud .compact-environment>[data-tone=warning]")];
    set(nodes.mobileNotice, notices.map((el) => `<span>${escape2(text(el))}</span>`).join(""));
    const work = document.querySelector(rogue ? "#rogueControls .rogue-work" : "#hud .compact-work"), progress = work?.querySelector("progress");
    const context = rogue ? [...document.querySelectorAll("#rogueControls [data-rogue-context]")].map(text) : [...document.querySelectorAll("#hud .compact-actions [data-hud-item=context],#hud .anchor-state")].map(text);
    if (rogue && rogue.dataset.mobileMode !== "sailing") context.unshift(text(document.querySelector("#rogueControls [data-rogue-action=primary]")));
    const dock = document.querySelector("#rogueControls .rogue-dock-checks");
    const checks = dock && getComputedStyle(dock).clipPath === "none" ? [...dock.children].map((el) => `<i class="${el.dataset.ok === "true" ? "ready" : ""}">${escape2(text(el))}</i>`).join("") : "";
    const label = rogue ? "" : text(work) || context.filter(Boolean).join(" \xB7 ");
    set(nodes.mobileContext, (checks ? `<div class="flight-dock">${checks}</div>` : "") + (label ? `<span>${escape2(label)}</span>` : "") + (!rogue && progress ? `<progress max="${progress.max}" value="${progress.value}" aria-label="${escape2(label)}"></progress>` : ""));
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
var kakao = /KAKAOTALK/i.test(navigator.userAgent) && !Capacitor.isNativePlatform();
function browserHelp(en) {
  const help = document.createElement("div");
  help.className = "mobile-browser-help";
  const external = document.createElement("a");
  external.className = "mobile-external";
  external.textContent = en ? "Open in external browser" : "\uC678\uBD80 \uBE0C\uB77C\uC6B0\uC800\uB85C \uC5F4\uAE30";
  external.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href);
  external.hidden = !kakao;
  external.addEventListener("click", () => pause());
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
  card.innerHTML = `<div class="rotate-phone" aria-hidden="true">\u21BB</div><h1>${en ? "Turn your phone sideways" : "\uD734\uB300\uD3F0\uC744 \uAC00\uB85C\uB85C \uB3CC\uB824\uC8FC\uC138\uC694"}</h1><p>${en ? "Use both hands with a wider view." : "\uB113\uC740 \uD654\uBA74\uC5D0\uC11C \uB450 \uC190\uC73C\uB85C \uC870\uC791\uD560 \uC218 \uC788\uC5B4\uC694."}</p><button class="mobile-request-landscape" type="button">${en ? "Try landscape fullscreen" : "\uAC00\uB85C \uC804\uCCB4\uD654\uBA74\uC73C\uB85C \uC2DC\uC791"}</button><p class="rotate-hint" role="status">${en ? "If rotation is blocked, unlock screen rotation and turn your phone." : "\uC790\uB3D9 \uD68C\uC804\uC774 \uC548 \uB418\uBA74 \uD734\uB300\uD3F0\uC758 \uD68C\uC804 \uC7A0\uAE08\uC744 \uD480\uACE0 \uC9C1\uC811 \uB3CC\uB824\uC8FC\uC138\uC694."}</p>`;
  if (kakao) card.append(browserHelp(en));
  rotate.append(card);
  card.querySelector("button").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
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
    e.target.disabled = false;
    refresh();
  });
}
document.body.append(rotate);
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
  mobileFrame = event.detail;
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
function resetStick() {
  thumb.style.transform = "translate(0px,0px)";
  stick.classList.remove("active", "floating");
  stickOrigin = null;
}
function release() {
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
  rogue: [["Space", "\uC81C\uB3D9 / \uACF5\uACA9", "Brake / Hit"], ["KeyE", "\uC791\uC5C5", "Interact"], ["ShiftLeft", "\uBD80\uC2A4\uD130", "Boost"], ["KeyC", "\uC815\uBC00", "Precision"], ["KeyQ", "\uD574\uC81C / \uC720\uC778", "Unmoor / Lure"], ["KeyF", "\uBCF4\uAE09", "Supplies"], ["KeyR", "\uC7A5\uBE44", "Gear"], ["KeyG", "\uC120\uC7A5 \uAE30\uC220", "Skill"], ["KeyM", "\uD574\uB3C4", "Chart"], ["KeyB", "\uBE4C\uB4DC", "Build"], ["KeyV", "\uD22C\uCC99", "Throw"], ["KeyX", "\uADF8\uBB3C \uC808\uB2E8", "Cut net"], ["KeyT", "\uACAC\uC778", "Tow"], ["KeyH", "\uBCF4\uAE09\uC815 \uB2FB", "Cargo anchor"]],
  story: [["Space", "\uC5ED\uCD94\uC9C4", "Reverse"], ["KeyQ", "\uBD80\uD45C", "Buoy"], ["KeyE", "\uC791\uC5C5", "Interact"], ["ShiftLeft", "\uBD80\uC2A4\uD130", "Boost"], ["KeyC", "\uC815\uBC00", "Precision"], ["KeyF", "\uD604\uC7A5 \uC791\uC5C5", "Work"], ["KeyZ", "\uC904 \uD480\uAE30", "Pay out"], ["KeyX", "\uC904 \uAC10\uAE30", "Reel in"], ["KeyB", "\uBE4C\uB4DC", "Build"], ["KeyG", "\uC6B0\uD68C", "Detour"], ["KeyI", "\uC120\uB0B4", "Interior"], ["KeyR", "\uBB34\uC804", "Radio"], ["KeyM", "\uD574\uB3C4", "Chart"]]
};
function render(next) {
  release();
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
    if (index >= 3) button.classList.add("mobile-extra");
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
  more.addEventListener("click", () => {
    release();
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
}
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
  actions.dataset.contextCount = available.length;
  actions.dataset.mode = mobileFrame?.mode || "";
  for (const button of actions.querySelectorAll("[data-context-slot]")) {
    const action = available[Number(button.dataset.contextSlot)];
    button.hidden = !action;
    if (!action) continue;
    const label = en ? action.labelEn : action.labelKo, name = action.code === "KeyF" ? "search" : action.code === "KeyR" ? "gear" : ["land", "board"].includes(action.id) ? "board" : "interact";
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
  hold("stick", [...x < -0.25 ? ["KeyA"] : x > 0.25 ? ["KeyD"] : [], ...y < -0.25 ? ["KeyW"] : y > 0.25 ? ["KeyS"] : []]);
}
document.addEventListener("pointerdown", (e) => {
  const onStick = e.target === stick || stick.contains(e.target), world = ["rogueSea", "space"].includes(e.target.id), side = moveSide === "left" ? e.clientX < innerWidth * 0.44 : e.clientX > innerWidth * 0.56;
  if (!playing || stickPointer !== null || e.button !== 0 || !onStick && !(world && side && e.clientY > Math.max(76, innerHeight * 0.28)) || mobileFrame?.mapOpen) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  stickPointer = e.pointerId;
  stickOrigin = { x: e.clientX, y: e.clientY };
  const half = stick.offsetWidth / 2;
  stick.style.setProperty("--stick-x", Math.max(half + 8, Math.min(innerWidth - half - 8, e.clientX)) + "px");
  stick.style.setProperty("--stick-y", Math.max(half + 8, Math.min(innerHeight - half - 8, e.clientY)) + "px");
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
  for (const body of document.querySelectorAll(".session-pause .session-body")) {
    if (body.querySelector(".mobile-help")) continue;
    const help = document.createElement("details");
    help.className = "mobile-help";
    help.open = true;
    help.innerHTML = language === "en" ? "<summary>Touch controls</summary><p>Touch the lower movement side and drag: the pad appears under your thumb. Release to drift; hold Brake to slow down. Swap sides below or from More.</p><p>Nearby mooring, boarding and search actions appear beside Attack. Hold Search until its ring fills. Tap the small chart to expand it. More contains the other tools. Pausing saves your run.</p>" : "<summary>\uD130\uCE58 \uC870\uC791</summary><p>\uC774\uB3D9 \uC190 \uCABD \uC544\uB798 \uC601\uC5ED\uC744 \uB204\uB974\uACE0 \uBC00\uBA74 \uADF8 \uC790\uB9AC\uC5D0 \uD328\uB4DC\uAC00 \uC0DD\uAE41\uB2C8\uB2E4. \uC190\uC744 \uB193\uC73C\uBA74 \uD45C\uB958\uD558\uACE0, \uC81C\uB3D9\uC744 \uAE38\uAC8C \uB204\uB974\uBA74 \uAC10\uC18D\uD569\uB2C8\uB2E4. \uC544\uB798 \uC124\uC815\uC774\uB098 \uB354 \uBCF4\uAE30\uC5D0\uC11C \uC88C\uC6B0\uB97C \uBC14\uAFC0 \uC218 \uC788\uC5B4\uC694.</p><p>\uAC00\uAE4C\uC6B4 \uC811\uC548\xB7\uC2B9\uD558\uC120\xB7\uC218\uC0C9 \uBC84\uD2BC\uC740 \uACF5\uACA9 \uC606\uC5D0 \uB098\uD0C0\uB0A9\uB2C8\uB2E4. \uC218\uC0C9\uC740 \uC9C4\uD589 \uB9C1\uC774 \uCC30 \uB54C\uAE4C\uC9C0 \uAE38\uAC8C \uB204\uB974\uC138\uC694. \uC791\uC740 \uD574\uB3C4\uB97C \uB204\uB974\uBA74 \uD655\uB300\uD569\uB2C8\uB2E4. \uB098\uBA38\uC9C0 \uB3C4\uAD6C\uB294 \uB354 \uBCF4\uAE30\uC5D0 \uC788\uACE0 \uC77C\uC2DC\uC815\uC9C0\uD558\uBA74 \uC800\uC7A5\uB429\uB2C8\uB2E4.</p>";
    body.prepend(help);
    if (kakao) body.append(browserHelp(language === "en"));
    if (voyageNotes) {
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
  for (const parent of document.querySelectorAll(".session-pause .session-body,.embark-options")) {
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
function compactPreparation() {
  const profile = document.getElementById("departureProfile"), en = language === "en";
  if (profile && !profile.querySelector(".mobile-captain-details")) {
    const details = document.createElement("details");
    details.className = "mobile-captain-details";
    const summary = document.createElement("summary");
    summary.textContent = en ? "Stats & skill" : "\uB2A5\uB825 \uC0C1\uC138";
    details.append(summary);
    for (const el of profile.querySelectorAll(".embark-stats,.embark-skill")) details.append(el);
    profile.append(details);
  }
  const build = document.getElementById("departureBuild");
  if (build && !build.querySelector(".mobile-build-details")) {
    const details = document.createElement("details");
    details.className = "mobile-build-details";
    const summary = document.createElement("summary");
    summary.textContent = en ? "Handling details" : "\uC6B4\uD56D \uC0C1\uC138";
    details.append(summary);
    for (const el of build.querySelectorAll(".embark-build-risk,.embark-key")) {
      el.textContent = touchText(el.textContent, language);
      details.append(el);
    }
    build.append(details);
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
  if (playing) voyageNotes = [...document.querySelectorAll("#rogueMission,#rogueRadio,#rogueConditions,#rogueControls,#hud .mission-objective,#hud .radio-panel,#hud .compact-conditions,#hud .compact-actions,#hud .passenger-status,#hud .hud-hint")].map((el) => el.textContent.trim()).filter(Boolean).join("\n\n");
  pad.hidden = !playing;
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
    const skill = actions.querySelector('[data-code="KeyG"]'), source = document.getElementById("rogueSkill");
    if (skill && source) {
      skill.title = source.title;
      skill.dataset.ready = String(source.getAttribute("aria-disabled") !== "true");
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
  refreshFlightHud(playing, rogue, mobileFrame);
}
setInterval(refresh, 100);
refresh();
window.addEventListener("blur", release, { capture: true });
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
