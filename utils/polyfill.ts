
// This file runs before the app to ensure process.env is set up correctly
declare global {
  interface Window {
    process: any;
  }
  var __STATIC_ENV__: any;
}

if (typeof window !== 'undefined') {
  window.process = window.process || {};
  window.process.env = window.process.env || {};
  
  // __STATIC_ENV__ is replaced by Vite at build time with the contents of .env
  // We use typeof check to prevent reference errors if it wasn't defined for some reason
  const staticEnv = (typeof __STATIC_ENV__ !== 'undefined') ? __STATIC_ENV__ : {};
  
  // runtimeEnv might be injected by the host environment (e.g. AI Studio)
  const runtimeEnv = window.process.env;
  
  // Merge: Static envs form the base, runtime envs override them if present.
  window.process.env = { ...staticEnv, ...runtimeEnv };
}

export {};
