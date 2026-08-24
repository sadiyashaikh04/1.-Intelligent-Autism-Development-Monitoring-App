/**
 * Lives apart from configs.ts so the logger can import NodeEnv without
 * importing config — configs.ts and logger.ts would otherwise form an
 * import cycle (config is logged, the logger reads config).
 */
export enum NodeEnv {
  DEVELOPMENT = "development",
  STAGING = "staging",
  PRODUCTION = "production",
  TEST = "test",
}
