import { config as loadDotenv } from 'dotenv';
import { envSchema, type AppConfig } from './env.js';

// Load .env file if present
loadDotenv();

export class ConfigValidationError extends Error {
  public readonly issues: Record<string, string[]>;

  constructor(message: string, issues: Record<string, string[]>) {
    super(message);
    this.name = 'ConfigValidationError';
    this.issues = issues;
  }
}

/**
 * Validates and returns the application configuration.
 * Throws a descriptive ConfigValidationError if configuration fails validation.
 */
export function loadConfig(rawEnv: Record<string, unknown> = process.env): AppConfig {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const issues: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'root';
      if (!issues[key]) {
        issues[key] = [];
      }
      issues[key].push(issue.message);
    }

    const formattedIssues = Object.entries(issues)
      .map(([key, msgs]) => `  - ${key}: ${msgs.join(', ')}`)
      .join('\n');

    throw new ConfigValidationError(
      `Invalid application configuration:\n${formattedIssues}`,
      issues
    );
  }

  return result.data;
}

export * from './env.js';
