// Another singleton. Store the current execution state of the workflow - is it running, is it stopped, etc.
// This is stored by runbook id.

export class WorkflowRuntime {
    private static instance: WorkflowRuntime;
    private constructor() {}

    private running: Record<string, boolean> = {};

    public static get() {
        if (!WorkflowRuntime.instance) {
            WorkflowRuntime.instance = new WorkflowRuntime();
        }

        return WorkflowRuntime.instance;
    }

    public setRunning(runbookId: string, running: boolean) {
        this.running[runbookId] = running;
    }

    public isRunning(runbookId: string) {
        return this.running[runbookId] ?? false;
    }
}
