import track_event from "@/tracking";
import { Button } from "@nextui-org/react";
import { Play, Square } from "lucide-react";

interface PlayButtonProps {
  isRunning: boolean;
  cancellable: boolean;
  onPlay: () => void;

  eventName?: string;
}

const PlayButton = ({
  isRunning,
  onPlay,
  cancellable,
  eventName,
}: PlayButtonProps) => {
  return (
    <Button
      isIconOnly
      color={isRunning ? "danger" : "success"}
      variant="flat"
      size="sm"
      aria-label={isRunning ? "Stop code" : "Run code"}
      onPress={() => {
        if (eventName) track_event(eventName, {});
        onPlay();
      }}
      className="w-8 h-8 min-w-unit-8 min-h-unit-8"
      isLoading={isRunning && !cancellable}
    >
      <span
        className={`transition-transform duration-300 ease-in-out ${isRunning ? "rotate-180" : ""}`}
      >
        {isRunning ? <Square size={16} /> : <Play size={16} />}
      </span>
    </Button>
  );
};

export default PlayButton;
