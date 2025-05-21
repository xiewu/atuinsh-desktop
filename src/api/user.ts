import { RemoteUser } from "@/state/models";
import { get } from "./api";

interface UserOrgInfo {
  id: string;
  name: string;
  slug: string;
}

interface MeResponse {
  user: {
    id: string;
    username: string;
    email: string;
    display_name: string;
    avatar_url: string;
  };
  orgs: UserOrgInfo[];
}

export function me(token?: string): Promise<MeResponse> {
  return get("/me", { token });
}

export async function searchUsers(query: string) {
  if (!query || query.length <= 2) return [];

  const { users } = await get<{ users: RemoteUser[] }>(`/users?query=${query}`);
  return users;
}
