import Block from "./block";

export class TerminalBlock extends Block {
    id: string;
    name: string;
    code: string;
    outputVisible: boolean;

    get typeName() {
        return "terminal";
    }

    constructor(id: string, name: string, code: string, outputVisible: boolean) {
        super();

        this.id = id;
        this.name = name;
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
        return new TerminalBlock(data.id, data.name, data.code, data.outputVisible);
    }
}

