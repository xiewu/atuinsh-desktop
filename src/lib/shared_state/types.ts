import * as jsondiffpatch from "jsondiffpatch";

export type SharableState = Record<string, unknown>;

export type Version = number;
export type ChangeRef = string;

export type ServerUpdate = {
  version: Version;
  delta: jsondiffpatch.Delta;
  change_ref: ChangeRef;
};

export enum Event {
  RESYNC_REQ = "resync",
  UPDATE = "update",
}
