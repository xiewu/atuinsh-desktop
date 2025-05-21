export default class Logger {
  private name: string;
  private color: string;

  constructor(name: string, lightColor: string = "black", darkColor: string = "white") {
    this.name = name;
    this.color = `light-dark(${lightColor}, ${darkColor})`;

    ["log", "warn", "error", "debug", "info"].forEach((method) => {
      (this as any)[method] = (console as any)[method].bind(console, ...this.header());
    });
  }

  time<T>(label: string, func: () => T, method?: string): T;
  time<T>(label: string, func: () => Promise<T>, method?: string): Promise<T>;
  time<T>(label: string, func: () => T | Promise<T>, method: string = "debug") {
    const start = performance.now();
    const result = func();

    if (result && (result as Promise<T>).then) {
      return Promise.resolve(result).then(() => {
        const end = performance.now();
        const delta = Math.floor(end - start);
        (this as any)[method](`${label}: ${delta}ms`);

        return result;
      });
    } else {
      const end = performance.now();
      const delta = Math.floor(end - start);
      (this as any)[method](`${label}: ${delta}ms`);

      return result;
    }
  }

  private header() {
    return [`%c[${this.name}]`, `color: ${this.color}`];
  }

  disable() {
    ["log", "warn", "error", "debug", "info"].forEach((method) => {
      (this as any)[method] = () => {};
    });
  }

  enable() {
    ["log", "warn", "error", "debug", "info"].forEach((method) => {
      (this as any)[method] = (console as any)[method].bind(console, ...this.header());
    });
  }

  log(..._args: any[]) {}
  warn(..._args: any[]) {}
  error(..._args: any[]) {}
  debug(..._args: any[]) {}
  info(..._args: any[]) {}
}
