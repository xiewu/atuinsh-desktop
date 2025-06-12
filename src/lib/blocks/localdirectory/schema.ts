import { DependencySpec } from "../../workflow/dependency";
import Block from "../../workflow/blocks/block";

export class LocalDirectoryBlock extends Block {
    path: string;

    get typeName() {
        return "local-directory";
    }

    constructor(id: string, name: string, dependency: DependencySpec, path: string) {
        super(id, name, dependency);
        this.path = path;
    }

    serialize() {
        return JSON.stringify({
            id: this.id,
            name: this.name,
            path: this.path,
        });
    }

    static deserialize(json: string) {
        const data = JSON.parse(json);
        return new LocalDirectoryBlock(data.id, data.name, data.dependency, data.path);
    }

    object() {
        return {
            id: this.id,
            name: this.name,
            path: this.path,
        };
    }
}

export const LOCALDIRECTORY_BLOCK_SCHEMA = {
  type: "local-directory",
  propSchema: {
    // No path prop - stored in KV store instead
  },
  content: "none",
} as const;
