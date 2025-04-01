import { Option, Some, None } from "@binarymuse/ts-stdlib";
import { useStore } from "@/state/store";
import { DialogAction, DialogRequest } from "@/state/store/dialog_state";
import { uuidv7 } from "uuidv7";

export class DialogBuilder<T> {
  private _title: Option<string> = None;
  private _message: Option<React.ReactNode> = None;
  private _actions: DialogAction<T>[] = [];
  private _icon: Option<DialogRequest<T>["icon"]> = None;

  constructor() {}

  public title(title: string) {
    this._title = Some(title);
    return this;
  }

  public message(message: React.ReactNode) {
    this._message = Some<React.ReactNode>(message);
    return this;
  }

  public icon(icon: DialogRequest<T>["icon"]) {
    this._icon = Some<DialogRequest<T>["icon"]>(icon);
    return this;
  }

  public action(action: DialogAction<T>) {
    this._actions.push(action);
    return this;
  }

  public build(): Promise<T> {
    if (this._actions.length === 0) {
      throw new Error("Actions are required");
    }

    let resolve: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });

    const request: DialogRequest<T> = {
      id: uuidv7(),
      title: this._title.unwrapOr(""),
      message: this._message.unwrapOr(<></>),
      actions: this._actions,
      icon: this._icon.unwrapOr(undefined),
      resolve: resolve!,
    };

    useStore.getState().addDialog(request);

    return promise;
  }
}

export function alert(title: string, message: string): Promise<void> {
  return new DialogBuilder<void>()
    .title(title)
    .message(message)
    .action({ label: "OK", value: undefined, variant: "flat" })
    .build();
}
