import { RemoteRunbook } from "@/state/models";
import Runbook from "@/state/runbooks/runbook";
import { get, post, put, del } from "./api";
import Snapshot from "@/state/runbooks/snapshot";

export async function allRunbookIds(): Promise<string[]> {
  const { runbooks } = await get<{ runbooks: string[] }>("/runbooks?id_only=true");
  return runbooks;
}

export async function getRunbookID(id: string): Promise<RemoteRunbook> {
  const { runbook } = await get<{ runbook: RemoteRunbook }>(
    `/runbooks/${id}?include=user,snapshots,collaborations`,
  );
  return runbook;
}

export function createRunbook(runbook: Runbook, slug: string, visibility: string) {
  const body = {
    runbook: {
      id: runbook.id,
      name: runbook.name,
      slug: slug,
      version: 0,
      created: runbook.created,
      visibility: visibility,
    },
  };

  return post("/runbooks", body);
}

export function updateRunbook(runbook: Runbook, slug: string, visibility: string) {
  const body = {
    runbook: {
      id: runbook.id,
      name: runbook.name,
      slug: slug,
      version: 0,
      created: runbook.created,
      visibility: visibility,
    },
  };

  return put(`/runbooks/${runbook.id}`, body);
}

export function deleteRunbook(id: string) {
  return del(`/runbooks/${id}`);
}

export interface RemoteSnapshot {
  id: string;
  tag: string;
  runbook_id: string;
  content: any[];
  created: string;
}

export async function getSnapshotById(id: string): Promise<RemoteSnapshot> {
  const { snapshot } = await get<{ snapshot: RemoteSnapshot }>(`/snapshots/${id}`);
  return snapshot;
}

export function createSnapshot(snapshot: Snapshot) {
  const args = {
    snapshot: {
      id: snapshot.id,
      tag: snapshot.tag,
      client_created: snapshot.created,
      content: snapshot.content,
    },
  };
  return post(`/runbooks/${snapshot.runbook_id}/snapshots`, args);
}

export function deleteSnapshot(id: string) {
  return del(`/snapshots/${id}`);
}

export interface RemoteCollaboration {
  id: string;
  accepted: boolean;
  runbook: {
    id: string;
    owner: string;
    slug: string;
    name: string;
  };
}
