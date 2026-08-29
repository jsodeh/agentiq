/// <reference types="vite/client" />
/// <reference types="vitest" />

interface ImportMetaEnv {
  readonly VITE_ANTHROPIC_API_KEY: string;
  readonly VITE_COMPOSIO_API_KEY: string;
  readonly VITE_DB_PATH: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'framer-motion';
declare module 'flutterwave-node-v3';
declare module 'paystack';
declare module 'pdfkit';
declare module 'react-window';

declare namespace Vi {
  interface Assertion<T = any> {
    toBeInTheDocument(): Assertion<T>;
    toBeDisabled(): Assertion<T>;
  }
}




