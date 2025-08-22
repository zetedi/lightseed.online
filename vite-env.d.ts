// src/vite-env.d.ts
interface ImportMetaEnv {
  readonly VITE_APP_TYPE?: string;
  readonly VITE_APP_TITLE?: string;
  readonly PROD: boolean;
  // Add other VITE_* environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly glob: <T = unknown>(pattern: string | string[], options?: { eager?: boolean }) => Record<string, T>;
}