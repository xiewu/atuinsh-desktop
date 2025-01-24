import HistoryRow from "./history/HistoryRow";

export default function HistoryList(props: any) {
  return (
    <div
      role="list"
      className="divide-y divide-gray-100 bg-content1 shadow-sm ring-1 ring-gray-900/5 overflow-auto select-none"
      style={{
        height: `${props.height}px`,
        position: "relative",
      }}
    >
      {props.items.map((i: any) => {
        let h = props.history[i.index];

        return (
          <div
            key={i.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${i.size}px`,
              transform: `translateY(${i.start}px)`,
            }}
          >
            <HistoryRow h={h} drawer={true} />
          </div>
        );
      })}
    </div>
  );
}
