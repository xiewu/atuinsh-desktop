import { Some } from "@binarymuse/ts-stdlib";
import Emittery from "emittery";

export default class RunbookBus extends Emittery {
  static instances: Map<string, WeakRef<RunbookBus>> = new Map();

  static get(runbookId: string): RunbookBus {
    return Some(RunbookBus.instances.get(runbookId))
      .andThen((ref) => Some(ref.deref()))
      .unwrapOrElse(() => {
        const bus = new RunbookBus();
        RunbookBus.instances.set(runbookId, new WeakRef(bus));
        return bus;
      });
  }

  constructor() {
    super();
  }

  public emitVariableChanged(name: string, value: string) {
    return this.emit("variable-changed", { name, value });
  }

  public onVariableChanged(callback: (name: string, value: string) => void) {
    return this.on("variable-changed", (evt: { name: string; value: string }) => {
      return callback(evt.name, evt.value);
    });
  }
}
