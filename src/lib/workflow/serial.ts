// Handle serial execution of blocks, from top to bottom of the document

import BlockBus from "./block_bus";
import Block from "./blocks/block";
import { convertBlocknoteToAtuin } from "./blocks/convert";

/**
 * 
 * @param document the blocknote document
 */
export function serialExecute(document: any[]) {
    let blocks = document.map(convertBlocknoteToAtuin).filter((b: Block | null) => b !== null);

    let blockBus = BlockBus.get();

    const getNextBlock = (block: Block) => {
        let index = blocks.findIndex((b: Block) => b.id === block.id);
        if (index > -1 && index < blocks.length - 1) {
            return blocks[index + 1];
        }
        return null;
    }

    const blockFinished = (block: Block) => {
        console.log(`Block ${block.id} finished`);
        blockBus.unsubscribeBlockFinished(block.id, blockFinished);

        let nextBlock = getNextBlock(block);
        if (!nextBlock) {
            return;
        }

        blockBus.runBlock(nextBlock.id);
    }

    for (let block of blocks) {
        blockBus.subscribeBlockFinished(block.id, blockFinished);
    }

    if (blocks.length > 0) {
        blockBus.runBlock(blocks[0].id);
    }
}