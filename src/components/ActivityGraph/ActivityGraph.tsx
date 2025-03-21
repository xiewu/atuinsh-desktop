import React from "react";
import { Tooltip as ReactTooltip } from "react-tooltip";
import ActivityCalendar from "react-activity-calendar";

const explicitTheme = {
  light: ["#f0f0f0", "#c4edde", "#7ac7c4", "#f73859", "#384259"],
  dark: ["#27272a", "#002e62", "#005bc4", "#338ef7", "#66aaf9"],
};

export interface ActivityGraphProps {
  calendar: any[];
  weekStart: number;
  colorMode: string;
  hideTotalCount?: boolean;
}

export default function ActivityGraph({
  calendar,
  weekStart,
  colorMode,
  hideTotalCount = true,
}: ActivityGraphProps) {
  let colorScheme = colorMode === "dark" ? "dark" : "light";

  return (
    <>
      <ActivityCalendar
        hideTotalCount={hideTotalCount}
        theme={explicitTheme}
        colorScheme={colorScheme as any}
        data={calendar}
        weekStart={weekStart as any}
        renderBlock={(block, activity) =>
          React.cloneElement(block, {
            "data-tooltip-id": "react-tooltip",
            "data-tooltip-html": `${activity.count} commands on ${activity.date}`,
          })
        }
      />
      <ReactTooltip id="react-tooltip" />
    </>
  );
}
