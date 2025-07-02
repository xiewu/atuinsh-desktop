import { None, Option, Some } from "@binarymuse/ts-stdlib";
import { Menu, MenuOptions } from "@tauri-apps/api/menu";
import { uuidv7 } from "uuidv7";

// By default, MenuOptions["items"] allows undefined, which we don't want
export type AtuinMenuItem = NonNullable<MenuOptions["items"]>[number];

export class MenuBuilder {
  _items: AtuinMenuItem[] = [];

  public item(item: ItemBuilder | AtuinMenuItem) {
    if (item instanceof ItemBuilder) {
      this._items.push(item.build());
    } else {
      this._items.push(item);
    }
    return this;
  }

  public items(items: AtuinMenuItem[] | ItemBuilder[]) {
    for (const item of items) {
      this.item(item);
    }
    return this;
  }

  public separator() {
    this._items.push({ item: "Separator" as const });
    return this;
  }

  public build(): Promise<Menu> {
    return Menu.new({
      items: this._items,
    });
  }
}

export class ItemBuilder {
  _id: Option<string> = None;
  _text: Option<string> = None;
  _action: Option<(id: string) => void> = None;
  _accelerator: Option<string> = None;
  _items: (AtuinMenuItem | ItemBuilder)[] = [];
  _enabled: Option<boolean> = None;

  public id(id: string) {
    this._id = Some(id);
    return this;
  }

  public text(text: string) {
    this._text = Some(text);
    return this;
  }

  public action(act: (id: string) => void) {
    this._action = Some(act);
    return this;
  }

  public accelerator(accelerator: string) {
    this._accelerator = Some(accelerator);
    return this;
  }

  public items(items: (AtuinMenuItem | ItemBuilder)[]) {
    for (const item of items) {
      this._items.push(item);
    }
    return this;
  }

  public enabled(enabled: boolean) {
    this._enabled = Some(enabled);
    return this;
  }

  public build(): AtuinMenuItem {
    let item: any = {};
    item.id = this._id.unwrapOr(uuidv7());
    item.text = this._text.unwrapOr("");
    item.action = this._action.unwrapOr(undefined);
    item.accelerator = this._accelerator.unwrapOr(undefined);
    item.enabled = this._enabled.unwrapOr(true);

    if (this._items.length > 0) {
      item.items = this._items.map((item) => (item instanceof ItemBuilder ? item.build() : item));
    }

    return item as AtuinMenuItem;
  }
}
