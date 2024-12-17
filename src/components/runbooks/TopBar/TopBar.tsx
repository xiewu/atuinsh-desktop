import Runbook from "@/state/runbooks/runbook";
import RelativeTime from "@/components/relative_time.tsx";
import { DateTime } from "luxon";

type TopbarProps = {
  runbook: Runbook | null;
  currentTag: string | null;
  // tags: string[]; // TODO: maybe get this from runbook?
  onSelectTag: (tag: string | null) => void;
};

/**
 * State that we need to care about/manage here:
 * - has the runbook been created on the server?
 *   - if so, does the current user own the runbook?
 *   - if so, what is the runbook slug and visibility
 * - what other users are editing the document right now
 * - has the current tag, if any, been pushed to the server?
 * - does the server contain any tags that differ from our own?
 */

export default function Topbar(props: TopbarProps) {
  let runbook = props.runbook;

  const renderBarContents = () => {
    if (!runbook) return null;

    return (
      <>
        <div>
          <div className="h-full content-center">{runbook && runbook.name}</div>
        </div>
        <div>
          <div className="h-full content-center text-gray-400 text-xs italic">
            Updated <RelativeTime time={DateTime.fromJSDate(runbook.updated)} />
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="flex w-full max-w-full overflow-hidden bg-gray-50 h-10 min-h-10 flex-row border-b px-2 justify-between">
      {renderBarContents()}
    </div>
  );
}
