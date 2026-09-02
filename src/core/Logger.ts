/**
 * Small tagged console logger. Bedrock's scripting runtime exposes a
 * `console` global that forwards to the Content Log / dedicated server
 * terminal, so this intentionally stays a thin wrapper rather than a full
 * logging framework.
 */
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3
}

/** Raise this to Warn/Error in production builds to quiet debug noise. */
const ACTIVE_LEVEL: LogLevel = LogLevel.Debug;

const LEVEL_LABEL: Readonly<Record<LogLevel, string>> = {
  [LogLevel.Debug]: "DEBUG",
  [LogLevel.Info]: "INFO",
  [LogLevel.Warn]: "WARN",
  [LogLevel.Error]: "ERROR"
};

export class Logger {
  private readonly tag: string;

  public constructor(tag: string) {
    this.tag = tag;
  }

  public debug(message: string, ...args: unknown[]): void {
    this.write(LogLevel.Debug, message, args);
  }

  public info(message: string, ...args: unknown[]): void {
    this.write(LogLevel.Info, message, args);
  }

  public warn(message: string, ...args: unknown[]): void {
    this.write(LogLevel.Warn, message, args);
  }

  public error(message: string, ...args: unknown[]): void {
    this.write(LogLevel.Error, message, args);
  }

  private write(level: LogLevel, message: string, args: unknown[]): void {
    if (level < ACTIVE_LEVEL) {
      return;
    }
    const prefix = `[${LEVEL_LABEL[level]}] [${this.tag}]`;
    if (args.length > 0) {
      console.log(`${prefix} ${message}`, ...args);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}
