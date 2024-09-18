// Handle building and searching an index of runbooks
// TODO: Switch to indexing numeric IDs only

import FlexSearch from "flexsearch";
import Runbook from "./runbook";

class RunbookIndexService {
  private index: FlexSearch.Index;

  constructor() {
    this.index = new FlexSearch.Index({
      preset: "performance",
      tokenize: "full",
      cache: true,
    });
  }

  public async addRunbook(runbook: Runbook) {
    await this.index.addAsync(runbook.id, runbook.content);
  }

  public async removeRunbook(id: string) {
    await this.index.removeAsync(id);
  }

  public async updateRunbook(runbook: Runbook) {
    await this.removeRunbook(runbook.id);
    await this.addRunbook(runbook);
  }

  public async searchRunbooks(query: string): Promise<string[]> {
    let res = await this.index.searchAsync(query);

    return res as string[];
  }

  // Bulk operations for efficiency
  public bulkAddRunbooks(runbooks: Runbook[]): void {
    runbooks.forEach((runbook) => this.addRunbook(runbook));
  }
}

export default RunbookIndexService;
