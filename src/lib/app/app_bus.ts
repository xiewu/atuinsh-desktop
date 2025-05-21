import Emittery from "emittery";

export default class AppBus extends Emittery {
  static instance: AppBus;

  static get() {
    if (!AppBus.instance) {
      AppBus.instance = new AppBus();
    }
    return AppBus.instance;
  }

  private constructor() {
    super();
  }

  public onResetEditor(callback: (runbookId: string) => void) {
    return this.on("reset-editor", callback);
  }

  public emitResetEditor(runbookId: string) {
    return this.emit("reset-editor", runbookId);
  }
}
