export default class Logger {
  private name: string;
  private color: string;

  constructor(
    name: string,
    lightColor: string = "black",
    darkColor: string = "white",
  ) {
    this.name = name;
    this.color = `light-dark(${lightColor}, ${darkColor})`;

    ["log", "warn", "error", "debug", "info"].forEach((method) => {
      (this as any)[method] = (console as any)[method].bind(
        console,
        ...this.header(),
      );
    });
  }

  private header() {
    return [`%c[${this.name}]`, `color: ${this.color}`];
  }

  log(..._args: any[]) {}
  warn(..._args: any[]) {}
  error(..._args: any[]) {}
  debug(..._args: any[]) {}
  info(..._args: any[]) {}
}
