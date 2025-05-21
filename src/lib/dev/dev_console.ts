export default class DevConsole {
  public static addAppObject(name: string, obj: any): typeof DevConsole {
    const win = window as any;
    win.app = win.app || {};
    win.app[name] = obj;

    return DevConsole;
  }
}
