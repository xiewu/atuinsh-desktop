import { useStore } from "@/state/store";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { ChartConfig, ChartContainer } from "@/components/ui/chart";

export default function TopChart({ chartData }: any) {
  const colorMode = useStore((state) => state.functionalColorMode);

  const chartConfig = {
    command: {
      label: "Command",
      color: colorMode === "dark" ? "#66aaf9" : "#c4edde",
    },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={chartConfig} className="w-full">
      <BarChart
        accessibilityLayer
        data={chartData}
        layout="vertical"
        margin={{
          right: 16,
        }}
      >
        <CartesianGrid horizontal={false} />
        <YAxis
          dataKey="command"
          type="category"
          tickLine={false}
          tickMargin={10}
          axisLine={false}
          tickFormatter={(value) => value.slice(0, 3)}
          hide
        />
        <XAxis dataKey="count" type="number" hide />
        <Bar dataKey="count" layout="vertical" fill={chartConfig.command.color} radius={4}>
          <LabelList
            dataKey="command"
            position="insideLeft"
            offset={8}
            className="fill-[--color-label]"
            fontSize={12}
          />
          <LabelList
            dataKey="count"
            position="right"
            offset={8}
            className="fill-foreground"
            fontSize={12}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
