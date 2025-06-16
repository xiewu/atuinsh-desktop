import { DependencySpec } from "../../workflow/dependency";
import Block from "../../workflow/blocks/block";

export class KubernetesBlock extends Block {
    command: string;
    mode: "preset" | "custom";
    interpreter: string;
    autoRefresh: boolean;
    refreshInterval: number;
    namespace: string;
    context: string;

    get typeName() {
        return "kubernetes-get";
    }

    constructor(
        id: string, 
        name: string, 
        dependency: DependencySpec, 
        command: string, 
        mode: "preset" | "custom",
        interpreter: string,
        autoRefresh: boolean,
        refreshInterval: number,
        namespace: string,
        context: string
    ) {
        super(id, name, dependency);

        this.command = command;
        this.mode = mode;
        this.interpreter = interpreter;
        this.autoRefresh = autoRefresh;
        this.refreshInterval = refreshInterval;
        this.namespace = namespace;
        this.context = context;
    }

    serialize() {
        return JSON.stringify({
            id: this.id,
            name: this.name,
            command: this.command,
            mode: this.mode,
            interpreter: this.interpreter,
            autoRefresh: this.autoRefresh,
            refreshInterval: this.refreshInterval,
            namespace: this.namespace,
            context: this.context,
        });
    }

    static deserialize(json: string) {
        const data = JSON.parse(json);
        return new KubernetesBlock(
            data.id, 
            data.name, 
            data.dependency, 
            data.command, 
            data.mode,
            data.interpreter,
            data.autoRefresh,
            data.refreshInterval,
            data.namespace,
            data.context
        );
    }

    object() {
        return {
            id: this.id,
            name: this.name,
            command: this.command,
            mode: this.mode,
            interpreter: this.interpreter,
            autoRefresh: this.autoRefresh,
            refreshInterval: this.refreshInterval,
            namespace: this.namespace,
            context: this.context,
        };
    }
}

export const KUBERNETES_LLM_PROMPT = `
    For 'kubernetes-get' blocks:
    - Two modes: 'preset' (common kubectl commands) or 'custom' (any kubectl command)
    - 'command' property contains either preset key (pods, services, etc.) or custom kubectl command
    - 'interpreter' specifies shell (bash, zsh, etc.)
    - 'autoRefresh' and 'refreshInterval' for automatic updates
    - Example: {"type": "kubernetes-get", "props": {"command": "pods", "mode": "preset", "name": "Pod List"}, "id": "original-id"}
`;

export const KUBERNETES_BLOCK_SCHEMA = {
  type: "kubernetes-get",
  propSchema: {
    name: { default: "" },
    command: { default: "kubectl get pods -o json" },
    mode: { default: "preset" },
    interpreter: { default: "bash" },
    autoRefresh: { default: false },
    refreshInterval: { default: 0 },
    namespace: { default: "" },
    context: { default: "" },
    dependency: { default: "{}" },
  },
  content: "none",
} as const;
