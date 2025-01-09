// Handle building and searching an index of runbooks
// TODO: Switch to indexing numeric IDs only

import FlexSearch from "flexsearch";
import Runbook from "./runbook";

class RunbookIndexService {
  private stored = new Map<string, Runbook>();
  private index: FlexSearch.Index;
  private lastIds: Set<string> = new Set();

  constructor() {
    this.index = new FlexSearch.Index({
      preset: "performance",
      tokenize: "full",
      cache: true,
    });
  }

  public bulkUpdateRunbooks(runbooks: Runbook[]): void {
    const ids = new Set(runbooks.map((rb) => rb.id));
    const added = new Set([...ids].filter((id) => !this.lastIds.has(id)));
    const removed = new Set([...this.lastIds].filter((id) => !ids.has(id)));

    runbooks.forEach((runbook) => {
      if (added.has(runbook.id)) {
        this.addRunbook(runbook);
      } else if (removed.has(runbook.id)) {
        this.removeRunbook(runbook.id);
      } else {
        this.indexRunbook(runbook);
      }
    });
  }

  public indexRunbook(runbook: Runbook) {
    // Since runbooks are immutable, we can skip reindexing if the runbook hasn't changed
    if (this.stored.has(runbook.id) && this.stored.get(runbook.id) === runbook) {
      return;
    }

    this.stored.set(runbook.id, runbook);
    this.updateRunbook(runbook);
  }

  public addRunbook(runbook: Runbook) {
    console.log("adding", runbook.name);
    this.stored.set(runbook.id, runbook);
    return this.index.addAsync(runbook.id, runbook.content);
  }

  public removeRunbook(id: string) {
    this.stored.delete(id);
    return this.index.removeAsync(id);
  }

  public async updateRunbook(runbook: Runbook) {
    await this.removeRunbook(runbook.id);
    return this.addRunbook(runbook);
  }

  public async searchRunbooks(query: string): Promise<string[]> {
    let res = await this.index.searchAsync(query);

    return res as string[];
  }
}

export default RunbookIndexService;
