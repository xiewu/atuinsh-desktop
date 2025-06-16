import { invoke } from "@tauri-apps/api/core";
import { findAllParentsOfType, getCurrentDirectory } from "@/lib/blocks/exec";
import { templateString } from "@/state/templates";
import { buildInterpreterCommand } from "@/lib/blocks/common/InterpreterSelector";

interface KubernetesGetExecuteRequest {
  command: string;
  interpreter: string;
  env: Record<string, string>;
  cwd: string;
}

interface KubernetesGetExecuteResponse {
  output: string;
  success: boolean;
  error?: string;
}

// Preset kubectl commands for easy mode
export const PRESET_COMMANDS = {
  pods: "kubectl get pods -o json",
  services: "kubectl get services -o json", 
  deployments: "kubectl get deployments -o json",
  configmaps: "kubectl get configmaps -o json",
  secrets: "kubectl get secrets -o json",
  nodes: "kubectl get nodes -o json",
  namespaces: "kubectl get namespaces -o json",
} as const;

export type PresetCommand = keyof typeof PRESET_COMMANDS;

export interface KubernetesExecutionContext {
  blockId: string;
  editor: any;
  currentRunbookId: string;
}

export async function executeKubernetesCommand(
  command: string,
  interpreter: string,
  context: KubernetesExecutionContext,
  namespace?: string,
  kubeContext?: string
): Promise<KubernetesGetExecuteResponse> {
  const { blockId, editor, currentRunbookId } = context;
  
  // Get working directory and environment variables
  const cwd = await getCurrentDirectory(editor, blockId, currentRunbookId);
  const vars = findAllParentsOfType(editor, blockId, "env");
  const env: Record<string, string> = {};

  // Process environment variables
  for (const envVar of vars) {
    const name = await templateString(
      blockId,
      envVar.props.name,
      editor.document,
      currentRunbookId
    );
    const value = await templateString(
      blockId,
      envVar.props.value,
      editor.document,
      currentRunbookId
    );
    env[name] = value;
  }

  // Template the command
  let templatedCommand = await templateString(
    blockId,
    command,
    editor.document,
    currentRunbookId
  );

  // Add namespace and context flags to kubectl commands if specified
  if (templatedCommand.includes("kubectl")) {
    if (namespace && namespace.trim()) {
      const namespacePart = await templateString(
        blockId,
        namespace,
        editor.document,
        currentRunbookId
      );
      if (namespacePart.trim()) {
        templatedCommand += ` --namespace ${namespacePart.trim()}`;
      }
    }
    
    if (kubeContext && kubeContext.trim()) {
      const contextPart = await templateString(
        blockId,
        kubeContext,
        editor.document,
        currentRunbookId
      );
      if (contextPart.trim()) {
        templatedCommand += ` --context ${contextPart.trim()}`;
      }
    }
  }

  const interpreterCommand = buildInterpreterCommand(interpreter);

  const request: KubernetesGetExecuteRequest = {
    command: templatedCommand,
    interpreter: interpreterCommand,
    env,
    cwd,
  };

  return await invoke<KubernetesGetExecuteResponse>("kubernetes_get_execute", { request });
}

export function parseKubernetesOutput(output: string): { data: any[], columns: any[] } {
  try {
    const parsed = JSON.parse(output);
    
    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error("Invalid kubectl JSON output - missing items array");
    }

    const items = parsed.items;
    if (items.length === 0) {
      return { data: [], columns: [] };
    }

    // Detect resource type and create appropriate columns
    const kind = parsed.items[0].kind.toLowerCase();
    
    switch (kind) {
      case "pod":
        return parsePods(items);
      case "service":
        return parseServices(items);
      case "deployment":
        return parseDeployments(items);
      case "configmap":
        return parseConfigMaps(items);
      case "secret":
        return parseSecrets(items);
      case "node":
        return parseNodes(items);
      case "namespace":
        return parseNamespaces(items);
      default:
        return parseGeneric(items);
    }
  } catch (error) {
    console.error("Failed to parse kubectl output:", error);
    // Return raw output as single column - split by lines for better display
    const lines = output.split('\n').filter(line => line.trim());
    const data = lines.map(line => [line]);
    return {
      data,
      columns: [{ id: "output", title: "Raw Output", width: 800 }]
    };
  }
}

function parsePods(items: any[]) {
  const data = items.map(item => [
    item.metadata?.name || "Unknown",
    item.metadata?.namespace || "default",
    getReadyStatus(item),
    item.status?.phase || "Unknown",
    getRestartCount(item),
    getAge(item.metadata?.creationTimestamp),
    item.status?.podIP || "",
    item.spec?.nodeName || "",
  ]);

  const columns = [
    { id: "name", title: "Name", width: 200 },
    { id: "namespace", title: "Namespace", width: 120 },
    { id: "ready", title: "Ready", width: 80 },
    { id: "status", title: "Status", width: 100 },
    { id: "restarts", title: "Restarts", width: 80 },
    { id: "age", title: "Age", width: 80 },
    { id: "ip", title: "IP", width: 120 },
    { id: "node", title: "Node", width: 150 },
  ];

  return { data, columns };
}

function parseServices(items: any[]) {
  const data = items.map(item => [
    item.metadata?.name || "Unknown",
    item.metadata?.namespace || "default",
    item.spec?.type || "ClusterIP",
    item.spec?.clusterIP || "",
    getExternalIP(item),
    getPorts(item.spec?.ports),
    getAge(item.metadata?.creationTimestamp),
  ]);

  const columns = [
    { id: "name", title: "Name", width: 200 },
    { id: "namespace", title: "Namespace", width: 120 },
    { id: "type", title: "Type", width: 100 },
    { id: "clusterIP", title: "Cluster IP", width: 120 },
    { id: "externalIP", title: "External IP", width: 120 },
    { id: "ports", title: "Ports", width: 150 },
    { id: "age", title: "Age", width: 80 },
  ];

  return { data, columns };
}

function parseDeployments(items: any[]) {
  const data = items.map(item => [
    item.metadata?.name || "Unknown",
    item.metadata?.namespace || "default",
    `${item.status?.readyReplicas || 0}/${item.spec?.replicas || 0}`,
    item.status?.updatedReplicas || 0,
    item.status?.availableReplicas || 0,
    getAge(item.metadata?.creationTimestamp),
  ]);

  const columns = [
    { id: "name", title: "Name", width: 200 },
    { id: "namespace", title: "Namespace", width: 120 },
    { id: "ready", title: "Ready", width: 100 },
    { id: "upToDate", title: "Up-to-date", width: 100 },
    { id: "available", title: "Available", width: 100 },
    { id: "age", title: "Age", width: 80 },
  ];

  return { data, columns };
}

function parseConfigMaps(items: any[]) {
  const data = items.map(item => [
    item.metadata?.name || "Unknown",
    item.metadata?.namespace || "default",
    Object.keys(item.data || {}).length,
    getAge(item.metadata?.creationTimestamp),
  ]);

  const columns = [
    { id: "name", title: "Name", width: 300 },
    { id: "namespace", title: "Namespace", width: 120 },
    { id: "data", title: "Data", width: 80 },
    { id: "age", title: "Age", width: 80 },
  ];

  return { data, columns };
}

function parseSecrets(items: any[]) {
  const data = items.map(item => [
    item.metadata?.name || "Unknown",
    item.metadata?.namespace || "default",
    item.type || "Opaque",
    Object.keys(item.data || {}).length,
    getAge(item.metadata?.creationTimestamp),
  ]);

  const columns = [
    { id: "name", title: "Name", width: 300 },
    { id: "namespace", title: "Namespace", width: 120 },
    { id: "type", title: "Type", width: 150 },
    { id: "data", title: "Data", width: 80 },
    { id: "age", title: "Age", width: 80 },
  ];

  return { data, columns };
}

function parseNodes(items: any[]) {
  const data = items.map(item => [
    item.metadata?.name || "Unknown",
    getNodeStatus(item),
    getNodeRoles(item),
    getAge(item.metadata?.creationTimestamp),
    item.status?.nodeInfo?.kubeletVersion || "",
  ]);

  const columns = [
    { id: "name", title: "Name", width: 200 },
    { id: "status", title: "Status", width: 100 },
    { id: "roles", title: "Roles", width: 150 },
    { id: "age", title: "Age", width: 80 },
    { id: "version", title: "Version", width: 120 },
  ];

  return { data, columns };
}

function parseNamespaces(items: any[]) {
  const data = items.map(item => [
    item.metadata?.name || "Unknown",
    item.status?.phase || "Unknown",
    getAge(item.metadata?.creationTimestamp),
  ]);

  const columns = [
    { id: "name", title: "Name", width: 300 },
    { id: "status", title: "Status", width: 100 },
    { id: "age", title: "Age", width: 80 },
  ];

  return { data, columns };
}

function parseGeneric(items: any[]) {
  // For unknown resource types, just show name, namespace, and age
  const data = items.map(item => [
    item.metadata?.name || "Unknown",
    item.metadata?.namespace || "cluster",
    item.kind || "Unknown",
    getAge(item.metadata?.creationTimestamp),
  ]);

  const columns = [
    { id: "name", title: "Name", width: 250 },
    { id: "namespace", title: "Namespace", width: 120 },
    { id: "kind", title: "Kind", width: 120 },
    { id: "age", title: "Age", width: 80 },
  ];

  return { data, columns };
}

// Helper functions
function getReadyStatus(pod: any): string {
  const containerStatuses = pod.status?.containerStatuses || [];
  const ready = containerStatuses.filter((c: any) => c.ready).length;
  const total = containerStatuses.length;
  return `${ready}/${total}`;
}

function getRestartCount(pod: any): number {
  const containerStatuses = pod.status?.containerStatuses || [];
  return containerStatuses.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);
}

function getAge(creationTimestamp: string): string {
  if (!creationTimestamp) return "Unknown";
  
  const created = new Date(creationTimestamp);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMinutes > 0) return `${diffMinutes}m`;
  return "<1m";
}

function getExternalIP(service: any): string {
  const ingress = service.status?.loadBalancer?.ingress;
  if (ingress && ingress.length > 0) {
    return ingress[0].ip || ingress[0].hostname || "";
  }
  return service.spec?.externalIPs?.join(",") || "";
}

function getPorts(ports: any[]): string {
  if (!ports || ports.length === 0) return "";
  return ports.map(p => `${p.port}/${p.protocol || "TCP"}`).join(",");
}

function getNodeStatus(node: any): string {
  const conditions = node.status?.conditions || [];
  const readyCondition = conditions.find((c: any) => c.type === "Ready");
  return readyCondition?.status === "True" ? "Ready" : "NotReady";
}

function getNodeRoles(node: any): string {
  const labels = node.metadata?.labels || {};
  const roles = [];
  
  if (labels["node-role.kubernetes.io/control-plane"] || labels["node-role.kubernetes.io/master"]) {
    roles.push("control-plane");
  }
  if (labels["node-role.kubernetes.io/worker"]) {
    roles.push("worker");
  }
  
  return roles.length > 0 ? roles.join(",") : "<none>";
}
