import Emittery from "emittery";
import Block from "./blocks/block";
import { listen } from "@tauri-apps/api/event";

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
    }
    return BlockBus.instance;
  }

  async setupTauriListeners() {
    await listen(`start-block`, (event: any) => {
      this.runBlock(event.payload);
    });

    await listen(`stop-block`, (event: any) => {
      this.stopBlock(event.payload);
    });

    await listen(`workflow-started`, (event: any) => {
      this.workflowStarted(event.payload);
    });

    await listen(`workflow-finished`, (event: any) => {
      this.workflowFinished(event.payload);
    });
  }

  constructor() {
    super();
    this.setupTauriListeners();
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
   * Notify a block that it should stop
   *
   * @param blockId - The id of the block to run
   */
  stopBlock(blockId: string) {
    this.emit(`stop_block:${blockId}`);
  }

  /**
   * Subscribe to a block stopping
   *
   * @param id - The id of the block to subscribe to
   * @param callback - The callback to call when the block stops
   */
  subscribeStopBlock(id: string, callback: () => void): () => void {
    return this.on(`stop_block:${id}`, callback);
  }

  /**
   * Unsubscribe from a block stopping
   *
   * @param id - The id of the block to unsubscribe from
   * @param callback - The callback to unsubscribe from
   */
  unsubscribeStopBlock(id: string, callback: () => void) {
    this.off(`stop_block:${id}`, callback);
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

  clearAllBlockFinishedSubscriptions(blockId: string) {
    this.clearListeners(`block_finished:${blockId}`);
  }

  // Should probs not be in the block bus
  // Figure out something for later

  startWorkflow(runbookId: string) {
    this.emit(`start_workflow:${runbookId}`);
  }

  subscribeStartWorkflow(id: string, callback: () => void): () => void {
    return this.on(`start_workflow:${id}`, callback);
  }

  unsubscribeStartWorkflow(id: string, callback: () => void) {
    this.off(`start_workflow:${id}`, callback);
  }

  /**
   * Notify the block bus that a runbook should be executed serially
   *
   * @param runbookId - The id of the runbook to execute
   */
  workflowStarted(runbookId: string) {
    this.emit(`workflow_started:${runbookId}`);
  }

  /**
   * Subscribe to a serial execution
   *
   * @param id - The id of the runbook to subscribe to
   * @param callback - The callback to call when the runbook should be executed serially
   */
  subscribeWorkflowStarted(id: string, callback: () => void): () => void {
    return this.on(`workflow_started:${id}`, callback);
  }

  /**
   * Unsubscribe from a serial execution
   */
  unsubscribeWorkflowStarted(id: string, callback: () => void) {
    this.off(`workflow_started:${id}`, callback);
  }

  /**
   * Notify the block bus that a serial execution should be stopped
   *
   * @param runbookId - The id of the runbook to stop
   */
  workflowFinished(runbookId: string) {
    this.emit(`workflow_finished:${runbookId}`);
  }

  /**
   * Subscribe to a serial stop
   */
  subscribeWorkflowFinished(id: string, callback: () => void): () => void {
    return this.on(`workflow_finished:${id}`, callback);
  }

  /**
   * Unsubscribe from a serial stop
   */
  unsubscribeWorkflowFinished(id: string, callback: () => void) {
    this.off(`workflow_finished:${id}`, callback);
  }
}
