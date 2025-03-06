import { Alias, DefaultHomeInfo, HomeInfo, ShellHistory, Var } from "../models";
import { parseISO } from "date-fns";
import { getWeekInfo } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import Logger from "@/lib/logger";
import { StateCreator } from "zustand";
const logger = new Logger("ShellInfoStore", "purple", "pink");

export interface AtuinShellInfoState {
  homeInfo: HomeInfo;
  aliases: Alias[];
  vars: Var[];
  shellHistory: ShellHistory[];
  calendar: any[];
  weekStart: number;

  refreshHomeInfo: () => void;
  refreshCalendar: () => void;
  refreshAliases: () => void;
  refreshVars: () => void;
  refreshShellHistory: (query?: string) => void;
  historyNextPage: (query?: string) => void;
}

export const persistShellInfoKeys: (keyof AtuinShellInfoState)[] = ["aliases", "vars", "weekStart"];

export const createShellInfoState: StateCreator<AtuinShellInfoState> = (
  set,
  get,
  _store,
): AtuinShellInfoState => ({
  homeInfo: DefaultHomeInfo,
  aliases: [],
  vars: [],
  shellHistory: [],
  calendar: [],
  weekStart: getWeekInfo().firstDay,

  refreshAliases: () => {
    invoke("aliases").then((aliases: any) => {
      set({ aliases: aliases });
    });
  },

  refreshCalendar: () => {
    invoke("history_calendar").then((calendar: any) => {
      set({ calendar: calendar });
    });
  },

  refreshVars: () => {
    invoke("vars").then((vars: any) => {
      set({ vars: vars });
    });
  },
  refreshShellHistory: (query?: string) => {
    if (query) {
      invoke("search", { query: query })
        .then((res: any) => {
          set({ shellHistory: res });
        })
        .catch((e) => {
          logger.log(e);
        });
    } else {
      invoke("list").then((res: any) => {
        set({ shellHistory: res });
      });
    }
  },

  refreshHomeInfo: () => {
    invoke("home_info")
      .then((res: any) => {
        set({
          homeInfo: {
            historyCount: res.history_count,
            recordCount: res.record_count,
            lastSyncTime: (res.last_sync && parseISO(res.last_sync)) || null,
            recentCommands: res.recent_commands,
            topCommands: res.top_commands.map((top: any) => ({
              command: top[0],
              count: top[1],
            })),
          },
        });
      })
      .catch((e) => {
        logger.error(e);
      });
  },
  historyNextPage: (query?: string) => {
    let history = get().shellHistory;
    let offset = history.length - 1;

    if (query) {
      invoke("search", { query: query, offset: offset })
        .then((res: any) => {
          set({ shellHistory: [...history, ...res] });
        })
        .catch((e) => {
          logger.error(e);
        });
    } else {
      invoke("list", { offset: offset }).then((res: any) => {
        set({ shellHistory: [...history, ...res] });
      });
    }
  },
});
