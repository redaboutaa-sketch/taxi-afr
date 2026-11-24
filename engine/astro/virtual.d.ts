declare module 'virtual:factory/config' {
  const config: import('../config/resolve.ts').ResolvedConfig;
  export default config;
}

declare module 'virtual:factory/form' {
  const form: {
    endpoint: string;
    contract: import('../form/contract.ts').FormContract;
    server: import('../form/contract.ts').ServerContract;
  } | null;
  export default form;
}

declare module 'virtual:factory/assets' {
  export interface PublicAsset {
    src: import('astro').ImageMetadata;
    alt: Record<string, string>;
    decorative: boolean;
    kind: string;
  }
  /** Lève si l'actif est inconnu ou non publiable : le build échoue. */
  export function asset(id: string): PublicAsset;
  const assets: Record<string, PublicAsset>;
  export default assets;
}
