import { warn, debug, info, error } from '@tauri-apps/plugin-log';

export default class Logger {
  private name: string;

  constructor(name: string) {
    this.name = name;
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

  log(msg: string, ...args: string[]) {
    let argsString = args.join(" ");
    let message = `[${this.name}]: ${msg} ${argsString}`;

    info(message);
  }
  warn(msg: string, ...args: string[]) {
    let argsString = args.join(" ");
    let message = `[${this.name}]: ${msg} ${argsString}`;

    warn(message);
  }
  error(msg: string, ...args: string[]) {
    let argsString = args.join(" ");
    let message = `[${this.name}]: ${msg} ${argsString}`;

    error(message);
  }
  debug(msg: string, ...args: string[]) {
    let argsString = args.join(" ");
    let message = `[${this.name}]: ${msg} ${argsString}`;

    debug(message);
  }
  info(msg: string, ...args: string[]) {
    let argsString = args.join(" ");
    let message = `[${this.name}]: ${msg} ${argsString}`;

    info(message);
  }
}
