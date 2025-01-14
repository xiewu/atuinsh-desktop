import { DateTime } from "luxon";
import { useEffect, useState } from "react";
import { clearInterval, setInterval } from "worker-timers";

type RelativeTimeProps = {
  time: DateTime;
};
export default function RelativeTime(props: RelativeTimeProps) {
  const [relativeTime, setRelativeTime] = useState(props.time.toRelative());

  useEffect(() => {
    setRelativeTime(props.time.toRelative());
    const interval = setInterval(() => {
      setRelativeTime(props.time.toRelative());
    }, 10000);

    return () => clearInterval(interval);
  }, [props.time]);

  return <span>{relativeTime}</span>;
}
