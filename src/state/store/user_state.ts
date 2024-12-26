import { me } from "@/api/api";
import { DefaultUser, User } from "../models";
import { StateCreator } from "zustand";

export interface AtuinUserState {
  user: User;
  isLoggedIn: () => boolean;
  refreshUser: () => Promise<void>;
}

export const persistUserKeys: (keyof AtuinUserState)[] = ["user"];

export const createUserState: StateCreator<AtuinUserState> = (
  set,
  get,
  _store,
): AtuinUserState => ({
  user: DefaultUser,

  isLoggedIn: () => {
    if (!get().user) return false;
    let user = get().user;

    if (!user.isLoggedIn) return false;

    return user.isLoggedIn();
  },
  refreshUser: async () => {
    try {
      let user = await me();

      if (!user) {
        set({ user: DefaultUser });
        return;
      }

      set({
        user: new User(user.user.username, user.user.email, "", user.user.avatar_url),
      });
    } catch (err: any) {
      if (!err.code) {
        // This was due to a network error, don't clear cached user
      } else {
        set({ user: DefaultUser });
      }
    }
  },
});
