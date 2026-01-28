/**
 * Simple logger utility
 * Can be extended to integrate with external logging services
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  data?: unknown
}

class Logger {
  private readonly isDev = process.env.NODE_ENV !== "production"

  private formatLog(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      data,
    }
  }

  private output(entry: LogEntry) {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`

    if (this.isDev) {
      // Colorful console output in development
      const colors: Record<LogLevel, string> = {
        debug: "\x1b[36m", // Cyan
        info: "\x1b[32m", // Green
        warn: "\x1b[33m", // Yellow
        error: "\x1b[31m", // Red
      }
      const reset = "\x1b[0m"

      console.info(`${colors[entry.level]}${prefix}${reset} ${entry.message}`)
      if (entry.data) {
        console.info(entry.data)
      }
    } else {
      // JSON output in production (for log aggregation services)
      console.info(JSON.stringify(entry))
    }
  }

  debug(message: string, data?: unknown) {
    if (this.isDev) {
      this.output(this.formatLog("debug", message, data))
    }
  }

  info(message: string, data?: unknown) {
    this.output(this.formatLog("info", message, data))
  }

  warn(message: string, data?: unknown) {
    this.output(this.formatLog("warn", message, data))
  }

  error(message: string, data?: unknown) {
    this.output(this.formatLog("error", message, data))
  }
}

export const logger = new Logger()
