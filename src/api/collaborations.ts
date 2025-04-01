import { del, get, post, put, RemoteCollaboration } from "./api";

interface CollaborationsIndexResponse {
  accepted: RemoteCollaboration[];
  pending: RemoteCollaboration[];
}

interface CollaborationResponse {
  collaboration: RemoteCollaboration;
}

export function getCollaborations(): Promise<CollaborationsIndexResponse> {
  return get("/collaborations");
}

export async function getCollaborationForRunbook(
  runbookId: string,
): Promise<RemoteCollaboration | null> {
  const collabResponse = await getCollaborations();
  const collabs = [...collabResponse.accepted, ...collabResponse.pending];
  const collab = collabs.find((c) => c.runbook.id === runbookId);
  return collab || null;
}

export async function getCollaborationById(id: string): Promise<RemoteCollaboration> {
  const { collaboration } = await get<CollaborationResponse>(`/collaborations/${id}`);
  return collaboration;
}

export async function createCollaborationInvitation(runbookId: string, userId: string) {
  return post(`/collaborations`, { runbook_id: runbookId, user_id: userId });
}

export function acceptCollaboration(id: string) {
  return put(`/collaborations/${id}`, { accepted: true });
}

export function declineCollaboration(id: string) {
  return put(`/collaborations/${id}`, { accepted: false });
}

export function deleteCollaboration(id: string) {
  return del<null>(`/collaborations/${id}`);
}
