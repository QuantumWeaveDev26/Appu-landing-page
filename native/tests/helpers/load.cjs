/**
 * Test loader: runs the app's TypeScript modules in Node (node:test) by transpiling them with
 * the project's TypeScript, and swaps phone-only packages (Expo modules, AsyncStorage, React
 * Native) for small fakes given in `stubs`. Each load() call gets a fresh module graph.
 */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const SRC = path.resolve(__dirname, '..', '..', 'src');
const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

function load(relFromSrc, stubs = {}) {
  const cache = new Map();

  function loadFile(abs) {
    if (cache.has(abs)) return cache.get(abs).exports;
    if (abs.endsWith('.json')) return JSON.parse(fs.readFileSync(abs, 'utf8'));
    const out = ts.transpileModule(fs.readFileSync(abs, 'utf8'), {
      fileName: abs,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    }).outputText;
    const mod = { exports: {} };
    cache.set(abs, mod);
    const req = (spec) => {
      if (Object.prototype.hasOwnProperty.call(stubs, spec)) return stubs[spec];
      if (spec.startsWith('.')) {
        const base = path.resolve(path.dirname(abs), spec);
        for (const ext of EXTS) {
          const p = base + ext;
          if (fs.existsSync(p) && fs.statSync(p).isFile()) return loadFile(p);
        }
        throw new Error(`Cannot resolve ${spec} from ${abs}`);
      }
      return require(require.resolve(spec, { paths: [path.dirname(abs)] }));
    };
    new Function('module', 'exports', 'require', out)(mod, mod.exports, req);
    return mod.exports;
  }

  return loadFile(path.join(SRC, relFromSrc));
}

/** In-memory AsyncStorage. */
function fakeAsyncStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const api = {
    data,
    getItem: async (k) => (data.has(k) ? data.get(k) : null),
    setItem: async (k, v) => void data.set(k, String(v)),
    removeItem: async (k) => void data.delete(k),
  };
  return { __esModule: true, default: api, ...api };
}

/** Runs `fn` with Date fixed at the given local time. */
async function atTime(isoLocal, fn) {
  const RealDate = Date;
  const fixed = new RealDate(isoLocal).getTime();
  class FakeDate extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [fixed]));
    }
    static now() {
      return fixed;
    }
  }
  global.Date = FakeDate;
  try {
    return await fn();
  } finally {
    global.Date = RealDate;
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const SRC_DIR = SRC;

module.exports = { load, fakeAsyncStorage, atTime, flush, SRC_DIR };
