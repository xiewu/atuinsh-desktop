import Emittery from "emittery";
import Block from "./blocks/block";

/**
 * A system for using events to communicate block changes
 * Try to detach from using the blocknote editor for state updates as much as
 * we can
 */
export default class BlockBus extends Emittery {
    static instance: BlockBus;

    static get() {
        if (!BlockBus.instance) {
            BlockBus.instance = new BlockBus();

            // if in dev mode, store the instance in the global window object for debugging
            if (import.meta.env.DEV) {
                // @ts-ignore
                window.blockBus = BlockBus.instance;
            }
        }
        return BlockBus.instance;
    }

    constructor() {
        super();
    }

    /**
     * Notify a block that its name has changed
     * 
     * @param block - The block that has changed
     */
    nameChanged(block: Block) {
        this.emit(`name_changed:${block.id}`, block);
    }

    /**
     * Subscribe to a block name changing
     * 
     * @param id - The id of the block to subscribe to
     * @param callback - The callback to call when the block name changes
     */
    subscribeNameChanged(id: string, callback: (block: Block) => void): () => void {
        return this.on(`name_changed:${id}`, callback);
    }

    /**
     * Unsubscribe from a block name changing
     * 
     * @param id - The id of the block to unsubscribe from
     * @param callback - The callback to unsubscribe from
     */
    unsubscribeNameChanged(id: string, callback: (block: Block) => void) {
        this.off(`name_changed:${id}`, callback);
    }

    /**
     * Notify a block that its dependencies have changed
     * 
     * @param block - The block that has changed
     */
    dependencyChanged(block: Block) {
        this.emit(`dependency_changed:${block.id}`, block);
    }

    /**
     * Subscribe to a block dependency changing
     * 
     * @param id - The id of the block to subscribe to
     * @param callback - The callback to call when the block dependency changes
     * @returns A function to unsubscribe from the block dependency changing
     */
    subscribeDependencyChanged(id: string, callback: (block: Block) => void): () => void {
        return this.on(`dependency_changed:${id}`, callback);
    }

    /**
     * Unsubscribe from a block dependency changing
     * 
     * @param id - The id of the block to unsubscribe from
     * @param callback - The callback to unsubscribe from
     */
    unsubscribeDependencyChanged(id: string, callback: (block: Block) => void) {
        this.off(`dependency_changed:${id}`, callback);
    }

    /**
     * Notify a block that it should run
     * 
     * @param blockId - The id of the block to run
     */
    runBlock(blockId: string) {
        this.emit(`run_block:${blockId}`);
    }

    /**
     * Subscribe to a block running
     * 
     * @param id - The id of the block to subscribe to
     * @param callback - The callback to call when the block runs
     * @returns A function to unsubscribe from the block running
     */
    subscribeRunBlock(id: string, callback: () => void): () => void {
        return this.on(`run_block:${id}`, callback);
    }

    /**
     * Unsubscribe from a block running
     * 
     * @param id - The id of the block to unsubscribe from
     * @param callback - The callback to unsubscribe from
     */
    unsubscribeRunBlock(id: string, callback: () => void) {
        this.off(`run_block:${id}`, callback);
    }

    /**
     * Notify a block that it has finished running
     * 
     * @param blockId - The id of the block that has finished running
     */
    blockFinished(block: Block) {
        this.emit(`block_finished:${block.id}`, block);
    }

    /**
     * Subscribe to a block finishing
     * 
     * @param id - The id of the block to subscribe to
     * @param callback - The callback to call when the block finishes running
     * @returns A function to unsubscribe from the block finishing
     */
    subscribeBlockFinished(id: string, callback: (block: Block) => void): () => void {
        return this.on(`block_finished:${id}`, callback);
    }

    /**
     * Unsubscribe from a block finishing
     * 
     * @param id - The id of the block to unsubscribe from
     * @param callback - The callback to unsubscribe from
     */
    unsubscribeBlockFinished(id: string, callback: (block: Block) => void) {
        this.off(`block_finished:${id}`, callback);
    }

    // Should probs not be in the block bus
    // Figure out something for later

    /**
     * Notify the block bus that a runbook should be executed serially
     * 
     * @param runbookId - The id of the runbook to execute
     */
    serialExecute(runbookId: string) {
        this.emit(`serial_execute:${runbookId}`);
    }

    /**
     * Subscribe to a serial execution
     * 
     * @param id - The id of the runbook to subscribe to
     * @param callback - The callback to call when the runbook should be executed serially
     */
    subscribeSerialExecute(id: string, callback: () => void): () => void {
        return this.on(`serial_execute:${id}`, callback);
    }

    /**
     * Unsubscribe from a serial execution
     */
    unsubscribeSerialExecute(id: string, callback: () => void) {
        this.off(`serial_execute:${id}`, callback);
    }
}   