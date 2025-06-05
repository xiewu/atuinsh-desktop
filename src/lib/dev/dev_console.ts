export default class DevConsole {
  public static addAppObject(name: string, obj: any): typeof DevConsole {
    if (typeof window === "undefined") {
      // wtf else can we do here?
      return DevConsole;
    }

    const win = window as any;
    win.app = win.app || {};
    win.app[name] = obj;

    return DevConsole;
  }
}
