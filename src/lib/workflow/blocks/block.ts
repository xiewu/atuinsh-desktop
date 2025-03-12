import { DependencySpec } from "../dependency";

// Base class for all blocks
export default abstract class Block {
    _id: string;
    _name: string;
    _dependency: DependencySpec;

    abstract get typeName(): string;
    abstract serialize(): string;

    get id(): string {
        return this._id;
    }

    get name(): string {
        return this._name;
    }

    get dependency(): DependencySpec {
        return this._dependency;
    }

    constructor(id: string, name: string, dependency: DependencySpec) {
        this._id = id;
        this._name = name;
        this._dependency = dependency;
    }

    abstract object(): any;
}