import { DependencySpec } from "../dependency";
import Block from "./block";

export default class Editor extends Block {
    code: string;
    language: string;

    get typeName() {
        return "editor";
    }

    constructor(id: string, name: string, dependency: DependencySpec, code: string, language: string) {
        super(id, name, dependency);

        this.code = code;
        this.language = language;
    }

    object() {
        return {
            id: this.id,
            name: this.name,
            code: this.code,
            language: this.language, 
        };
    }

    serialize() {
        return JSON.stringify(this.object());
    }
    
}