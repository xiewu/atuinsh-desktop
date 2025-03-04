import Block from "./block";

export class ScriptBlock extends Block {
    id: string;
    name: string;
    code: string;
    interpreter: string;
    outputVariable: string;
    outputVisible: boolean;

    get typeName() {
        return "script";
    }

    constructor(id: string, name: string, code: string, interpreter: string, outputVariable: string, outputVisible: boolean) {
        super();

        this.id = id;
        this.name = name;
        this.code = code;
        this.interpreter = interpreter;
        this.outputVariable = outputVariable;
        this.outputVisible = outputVisible; 
    }

    serialize() {
        return JSON.stringify({
            id: this.id,
            name: this.name,
            code: this.code,
            interpreter: this.interpreter,
            outputVariable: this.outputVariable,
            outputVisible: this.outputVisible,
        });
    }
    
    static deserialize(json: string) {
        const data = JSON.parse(json);
        return new ScriptBlock(data.id, data.name, data.code, data.interpreter, data.outputVariable, data.outputVisible);
    }
}
