// Base class for all blocks
export default abstract class Block {
    abstract get typeName(): string;
    abstract serialize(): string;
}