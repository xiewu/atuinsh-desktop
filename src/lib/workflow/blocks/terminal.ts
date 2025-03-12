import { DependencySpec } from "../dependency";
import Block from "./block";

export class TerminalBlock extends Block {
    code: string;
    outputVisible: boolean;

    get typeName() {
        return "terminal";
    }

    constructor(id: string, name: string, dependency: DependencySpec, code: string, outputVisible: boolean) {
        super(id, name, dependency);

        this.code = code;
        this.outputVisible = outputVisible;
    }

    serialize() {
        return JSON.stringify({
            id: this.id,
            name: this.name,
            code: this.code,
            outputVisible: this.outputVisible,
        });
    }

    static deserialize(json: string) {
        const data = JSON.parse(json);
        return new TerminalBlock(data.id, data.name, data.dependency, data.code, data.outputVisible);
    }

    object() {
        return {
            id: this.id,
            name: this.name,
            code: this.code,
            outputVisible: this.outputVisible,
        };
    }
}
