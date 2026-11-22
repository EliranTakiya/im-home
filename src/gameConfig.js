// Development builds open the full catalog. Production respects permanent grants.
export const DEVELOPMENT_MODE = import.meta.env?.DEV ?? false
