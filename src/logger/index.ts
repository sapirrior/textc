export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 4,
};

const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
};

export class Logger {
    private level: LogLevel;
    private useColors: boolean;

    constructor(level?: LogLevel) {
        this.level = level ?? (process.env["DEBUG"] ? "debug" : "info");
        this.useColors = !process.env["NO_COLOR"] && process.env["TERM"] !== "dumb";
    }

    public setLevel(level: LogLevel): void {
        this.level = level;
    }

    private colorize(colorCode: string, text: string): string {
        return this.useColors ? `${colorCode}${text}${c.reset}` : text;
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
    }

    private prefix(color: string, label: string): string {
        const textc = this.useColors ? `${c.reset}${c.bold}textc${c.reset}` : "textc";
        const levelTag = this.colorize(color, label);
        return `${textc} ${levelTag}`;
    }

    public debug(...args: unknown[]): void {
        if (this.shouldLog("debug")) {
            console.debug(this.prefix(c.gray, "debug"), ...args);
        }
    }

    public info(...args: unknown[]): void {
        if (this.shouldLog("info")) {
            console.info(this.prefix(c.cyan, "info"), ...args);
        }
    }

    public warn(...args: unknown[]): void {
        if (this.shouldLog("warn")) {
            console.warn(this.prefix(c.yellow, "warn"), ...args);
        }
    }

    public error(...args: unknown[]): void {
        if (this.shouldLog("error")) {
            console.error(this.prefix(c.red, "error"), ...args);
        }
    }
}

export const logger = new Logger();
export default logger;
