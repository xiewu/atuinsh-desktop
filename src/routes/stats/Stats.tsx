import ActivityGraph from "@/components/ActivityGraph/ActivityGraph";
import { AtuinState, useStore } from "@/state/store";
import { Button, Card, CardBody, CardHeader, DateRangePicker, Input } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { parseDate } from "@internationalized/date";
import TopCommands from "@/components/TopCommands/TopCommands";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const StatsFilterBar = ({
  onRefresh,
  onPathFilterChange,
  onHostFilterChange,
  onCommandFilterChange,
  dateRange,
  onDateRangeChange,
  isLoading,
}: any) => {
  const [pathFilter, setPathFilter] = useState("");
  const [hostFilter, setHostFilter] = useState("");
  const [commandFilter, setCommandFilter] = useState("");

  const handlePathFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPathFilter(value);
    onPathFilterChange?.(value);
  };

  const handleHostFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHostFilter(value);
    onHostFilterChange?.(value);
  };

  const handleCommandFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCommandFilter(value);
    onCommandFilterChange?.(value);
  };

  return (
    <Card shadow="sm">
      <CardHeader>
        <h2 className="uppercase text-gray-500">Filter</h2>
      </CardHeader>
      <CardBody className="flex flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            variant="bordered"
            placeholder="Command"
            value={commandFilter}
            onChange={handleCommandFilterChange}
            className="w-full"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>
        <div className="flex-1">
          <Input
            type="text"
            variant="bordered"
            placeholder="Path"
            value={pathFilter}
            onChange={handlePathFilterChange}
            className="w-full"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>
        <div className="flex-1">
          <Input
            type="text"
            variant="bordered"
            placeholder="Hostname"
            value={hostFilter}
            onChange={handleHostFilterChange}
            className="w-full"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>
        <div>
          <DateRangePicker variant="bordered" value={dateRange} onChange={onDateRangeChange} />
        </div>
        <Button onPress={onRefresh} isIconOnly variant="flat" aria-label="Refresh statistics" isLoading={isLoading}>
          <RefreshCw className="h-5 w-5" />
        </Button>
      </CardBody>
    </Card>
  );
};

const fetchStats = async (
  command_like: string,
  path_like: string,
  hostname_like: string,
  start: number,
  end: number,
) => {
  let calendar = await invoke("history_calendar", {
    command: command_like,
    path: path_like,
    hostname: hostname_like,
    start: start,
    end: end,
  });

  let stats = await invoke("command_stats", {
    command: command_like,
    path: path_like,
    hostname: hostname_like,
    start: start,
    end: end,
  });

  return { calendar, stats };
};

interface Stats {
  count: number;
  top_commands?: Array<[string, number]>;
  exit_code_distribution?: Array<[number, number]>;
}

const Stats = () => {
  const [loading, setLoading] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [hostnameFilter, setHostnameFilter] = useState("");
  const [calendar, setCalendar] = useState([]);
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    return {
      start: parseDate(oneYearAgo.toISOString().split("T")[0]),
      end: parseDate(today.toISOString().split("T")[0]),
    };
  });
  const [stats, setStats] = useState<Stats>({ count: 0 });

  useEffect(() => {
    setLoading(true);
    fetchStats(
      commandFilter,
      pathFilter,
      hostnameFilter,
      dateRange.start.toDate("UTC").getTime(),
      dateRange.end.toDate("UTC").getTime(),
    ).then(({ calendar, stats }: any) => {
      setCalendar(calendar);
      setStats(stats);
      setLoading(false);
    });
  }, []);

  let topCommands = useMemo(() => {
    if (!stats.top_commands) {
      return [];
    }
    return stats.top_commands.map((command) => ({
      command: command[0],
      count: command[1],
    }));
  }, [stats.top_commands]);

  const weekStart = useStore((state: AtuinState) => state.weekStart);
  const colorMode = useStore((state: AtuinState) => state.functionalColorMode);
  
  // Use theme colors that match the activity graph
  const themeColors = {
    light: ["#f0f0f0", "#c4edde", "#7ac7c4", "#f73859", "#384259"],
    dark: ["#27272a", "#002e62", "#005bc4", "#338ef7", "#66aaf9"],
  };
  
  // Choose colors based on current color mode
  const COLORS = colorMode === 'dark' ? themeColors.dark : themeColors.light;
  
  // Success color - use a green that works in both themes
  const SUCCESS_COLOR = colorMode === 'dark' ? '#4CAF50' : '#4CAF50';
  // Other errors color - use a neutral color
  const OTHER_ERRORS_COLOR = colorMode === 'dark' ? '#27272a' : '#f0f0f0';

  const exitCodeData = useMemo(() => {
    if (!stats.exit_code_distribution) {
      return [];
    }
    
    // Group all error codes except the most common ones
    const successCode = stats.exit_code_distribution.find(([code]) => code === 0);
    const successCount = successCode ? successCode[1] : 0;
    
    // Sort by count (descending) and take top errors
    const sortedErrors = stats.exit_code_distribution
      .filter(([code]) => code !== 0)
      .sort((a, b) => b[1] - a[1]);
    
    // Take top 5 errors
    const topErrors = sortedErrors.slice(0, 5);
    
    // Sum the rest into "Other Errors"
    const otherErrorsCount = sortedErrors.slice(5).reduce((sum, [_, count]) => sum + count, 0);
    
    const result = [
      { exitCode: "Success (0)", count: successCount, rawExitCode: 0 },
      ...topErrors.map(([code, count]) => ({ 
        exitCode: `Error (${code})`, 
        count, 
        rawExitCode: code 
      }))
    ];
    
    // Add "Other Errors" category if there are any
    if (otherErrorsCount > 0) {
      result.push({ 
        exitCode: "Other Errors", 
        count: otherErrorsCount, 
        rawExitCode: -999 // Special code to identify this category
      });
    }
    
    return result;
  }, [stats.exit_code_distribution]);

  return (
    <div className="flex flex-col gap-4 w-full pl-10 pr-10 pt-4">
      <div>
        <StatsFilterBar
          isLoading={loading}
          onPathFilterChange={setPathFilter}
          onHostFilterChange={setHostnameFilter}
          onCommandFilterChange={setCommandFilter}
          onDateRangeChange={setDateRange}
          dateRange={dateRange}
          onRefresh={async () => {
            setLoading(true);
            const { calendar, stats } = await fetchStats(
              commandFilter,
              pathFilter,
              hostnameFilter,
              dateRange.start.toDate("UTC").getTime(),
              dateRange.end.toDate("UTC").getTime(),
            );
            setLoading(false);
            setCalendar(calendar as any);
            setStats(stats as any);
          }}
        />
      </div>

      <div className="grid grid-cols-5 gap-4 pt-4 w-full">
        <Card shadow="sm" className="col-span-4">
          <CardHeader>
            <h2 className="uppercase text-gray-500">Activity graph</h2>
          </CardHeader>
          <CardBody>
            {calendar.length > 0 && (
              <ActivityGraph calendar={calendar} weekStart={weekStart} colorMode={colorMode} />
            )}
          </CardBody>
        </Card>

        <Card shadow="sm" className="col-span-1">
          <CardBody className="flex items-center justify-center">
            <h2 className="font-bold text-4xl dark:text-gray-300">
              {stats.count.toLocaleString()}
            </h2>
            <h3 className="pt-2 uppercase text-gray-500">Total Commands</h3>
          </CardBody>
        </Card>

        <Card shadow="sm" className="col-span-3">
          <CardHeader>
            <h2 className="uppercase text-gray-500">Top commands</h2>
          </CardHeader>
          <CardBody>
            <TopCommands chartData={topCommands} />
          </CardBody>
        </Card>

        <Card shadow="sm" className="col-span-2">
          <CardHeader>
            <h2 className="uppercase text-gray-500">Exit code distribution</h2>
          </CardHeader>
          <CardBody className="p-0 flex items-center justify-center">
            <div style={{ width: '100%', height: 300 }}>
              {exitCodeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={exitCodeData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
                      outerRadius={130}
                      fill="#8884d8"
                      dataKey="count"
                      nameKey="exitCode"
                    >
                      {exitCodeData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.rawExitCode === 0 ? SUCCESS_COLOR : 
                               (entry.rawExitCode === -999 ? OTHER_ERRORS_COLOR : COLORS[(index % COLORS.length)])} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, _: string, props: any) => [`${value} commands (${((value/stats.count)*100).toFixed(1)}%)`, props.payload.exitCode]}
                      labelFormatter={() => ''}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  No exit code data available
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default Stats;
