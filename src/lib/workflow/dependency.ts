import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Block from "./blocks/block";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

export function useDependencyState(block: Block, isRunning: boolean | null | undefined) {
  const [canRun, setCanRun] = useState<boolean>(true);
  const unlistenExecLogCompleted = useRef<UnlistenFn | null>(null);

  const updateCanRun = async () => {
    let cr = await block.dependency.canRun(block);
    setCanRun(cr);

    if (cr && block.dependency.within) {
      setTimeout(() => {
        updateCanRun();
      }, block.dependency.within * 1000);
    }
  };

  useEffect(() => {
    (async () => {
      if (unlistenExecLogCompleted.current) {
        unlistenExecLogCompleted.current();
      }

      const unlisten = await listen(
        `exec_log_completed:${block.dependency.parent}`,
        async (event: any) => {
          console.log("exec_log_completed", event);
          updateCanRun();
        },
      );

      unlistenExecLogCompleted.current = unlisten;
    })();
    return () => {
      if (unlistenExecLogCompleted.current) {
        unlistenExecLogCompleted.current();
      }
    };
  }, [block.dependency]);

  useEffect(() => {
    if (!isRunning) return;

    updateCanRun();
  }, [isRunning]);

  useEffect(() => {
    (async () => {
      if (unlistenExecLogCompleted.current) {
        unlistenExecLogCompleted.current();
      }

      const unlisten = await listen(
        `exec_log_completed:${block.dependency.parent}`,
        async (event: any) => {
          console.log("exec_log_completed", event);
          updateCanRun();
        },
      );

      unlistenExecLogCompleted.current = unlisten;
    })();
    return () => {
      if (unlistenExecLogCompleted.current) {
        unlistenExecLogCompleted.current();
      }
    };
  }, [block.dependency]);

  useEffect(() => {
    updateCanRun();
  }, [isRunning]);

  useEffect(() => {
    block.dependency.canRun(block).then(setCanRun);
  }, [block.dependency]);

  return { canRun };
}

export class DependencySpec {
  // For now we will only expose setting a single parent, but in the future we will support multiple parents
  parents: string[] = [];

  // The time within which the parent must be run
  // This is in seconds
  //
  // If set to 0, the parent must be run immediately before the child, every time.
  //
  // If set to a positive number, the child can run any number of times within the duration.
  // For example, an aws login block that runs every 12 hours can have a dependency on a parent block that must run every 12 hours.
  //
  // If set to -1, the parent must have been ran at least once, at any time, before the child can run.
  within: number = 0;

  autoRunParents: boolean = true;

  static empty(): DependencySpec {
    return new DependencySpec([]);
  }

  get parent() {
    if (this.parents.length === 0) {
      return null;
    }

    return this.parents[0];
  }

  constructor(parents: string[] = [], within: number = 0) {
    this.parents = parents;
    this.within = within;
  }

  static deserialize(json: string): DependencySpec {
    let obj = JSON.parse(json);
    return new DependencySpec(obj.parents, obj.within || 0);
  }

  serialize(): string {
    return JSON.stringify(this);
  }

  async canRun(block: Block): Promise<boolean> {
    return await invoke("can_run", {
      spec: this,
      block: { type: block.typeName, ...block.object() },
    });
  }
}
