import { StateCreator } from "zustand";
import Logger from "@/lib/logger";
import * as api from "@/api/api";
let logger = new Logger("collaboration_state", "DarkTurquoise", "PaleTurquoise");

export interface Collaboration {
  id: string;
  accepted: boolean;
  runbook: {
    id: string;
    owner: string;
    slug: string;
    name: string;
  };
}

export interface AtuinCollaborationState {
  collaborations: Collaboration[];
  pendingInvitations: number;

  addCollaboration: (collaboration: Collaboration) => void;
  removeCollaboration: (collaborationId: string) => void;
  markCollaborationAccepted: (collaborationId: string) => void;
  setCollaborations: (collaborations: Collaboration[]) => void;

  refreshCollaborations: () => Promise<void>;
}

export const persistCollaborationKeys: (keyof AtuinCollaborationState)[] = ["pendingInvitations"];

export const createCollaborationState: StateCreator<AtuinCollaborationState> = (
  set,
  get,
  _store,
): AtuinCollaborationState => ({
  collaborations: [],
  pendingInvitations: 0,

  addCollaboration: (collab: Collaboration) => {
    const { collaborations, setCollaborations } = get();
    setCollaborations([...collaborations, collab]);
  },

  removeCollaboration: (collabId: string) => {
    const { collaborations, setCollaborations } = get();
    setCollaborations(collaborations.filter((c) => c.id !== collabId));
  },

  markCollaborationAccepted: (collabId: string) => {
    const { collaborations, setCollaborations } = get();
    const idx = collaborations.findIndex((c) => c.id === collabId);
    const collab = collaborations[idx];
    const otherCollabs = collaborations.slice(0, idx).concat(collaborations.slice(idx + 1));
    setCollaborations([...otherCollabs, { ...collab, accepted: true }]);
  },

  setCollaborations: (collaborations: Collaboration[]) => {
    const collabsById = new Map<string, Collaboration>();
    for (const collab of collaborations) {
      collabsById.set(collab.id, collab);
    }

    if (collabsById.size !== collaborations.length) {
      logger.warn("duplicate collaborations detected; deduping");
      collaborations = Array.from(collabsById.values());
    }

    const pendingCount = collaborations.filter((c) => !c.accepted).length;
    set({ collaborations: collaborations, pendingInvitations: pendingCount });
  },

  refreshCollaborations: async () => {
    const { setCollaborations } = get();
    try {
      const { accepted, pending } = await api.getCollaborations();
      setCollaborations([...accepted, ...pending]);
    } catch (err) {
      if (err instanceof api.HttpResponseError) {
        // We're online but got a 4xx response, likely not authorized
        setCollaborations([]);
      }
    }
  },
});
