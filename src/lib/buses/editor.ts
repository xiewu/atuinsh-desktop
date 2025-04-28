import Emittery from "emittery";
import { useEffect } from "react";

/**
 * A system for using events to communicate editor state changes
 * Allows components to subscribe to editor state changes
 */
export default class EditorBus extends Emittery {
  static instance: EditorBus;

  static get() {
    if (!EditorBus.instance) {
      EditorBus.instance = new EditorBus();

      // If in dev mode, store the instance in the global window object for debugging
      if (import.meta.env.DEV) {
        // @ts-ignore
        window.editorBus = EditorBus.instance;
      }
    }
    return EditorBus.instance;
  }

  constructor() {
    super();
  }

  emitBlockInserted(type: string, props: any) {
    this.emit(`block_inserted:${type}`, props);
  }

  emitBlockDeleted(type: string, props: any) {
    this.emit(`block_deleted:${type}`, props);
  }


  subscribeBlockInserted(
    type: string,
    callback: (props: any) => void,
  ) {
    return this.on(`block_inserted:${type}`, callback);
  }

  unsubscribeBlockInserted(
    type: string,
    callback: (props: any) => void,
  ) {
    this.off(`block_inserted:${type}`, callback);
  }

  subscribeBlockDeleted(
    type: string,
    callback: (props: any) => void,
  ) {
    return this.on(`block_deleted:${type}`, callback);
  }

  unsubscribeBlockDeleted(
    type: string,
    callback: (props: any) => void,
  ) {
    this.off(`block_deleted:${type}`, callback);
  }
}

export const useBlockInserted = (type: string, callback: (event: any) => void) => {
  useEffect(() => {
    const unsubscribe = EditorBus.get().subscribeBlockInserted(type, callback);

    return () => {
      unsubscribe();
    };
  }, [type, callback]);
}

export const useBlockDeleted = (type: string, callback: (event: any) => void) => {
  useEffect(() => {
    const unsubscribe = EditorBus.get().subscribeBlockDeleted(type, callback);

    return () => {
      unsubscribe();
    };
  }, [type, callback]);
}   