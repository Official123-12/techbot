function format(level: string, objOrMsg: unknown, msg?: string): string {
  const ts = new Date().toISOString();
  if (typeof objOrMsg === "string") return `${ts} [${level}] ${objOrMsg}`;
  if (msg) return `${ts} [${level}] ${msg} ${JSON.stringify(objOrMsg)}`;
  return `${ts} [${level}] ${JSON.stringify(objOrMsg)}`;
}

export const logger = {
  info: (objOrMsg: unknown, msg?: string) => console.log(format("INFO", objOrMsg, msg)),
  error: (objOrMsg: unknown, msg?: string) => console.error(format("ERROR", objOrMsg, msg)),
  warn: (objOrMsg: unknown, msg?: string) => console.warn(format("WARN", objOrMsg, msg)),
  fatal: (objOrMsg: unknown, msg?: string) => console.error(format("FATAL", objOrMsg, msg)),
};
