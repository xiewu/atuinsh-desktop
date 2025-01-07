import { endpoint } from "@/api/api";
import { useStore } from "@/state/store";
import { Chip } from "@nextui-org/react";
import { open } from "@tauri-apps/plugin-shell";

export function PendingInvitations() {
  const { pendingInvitations } = useStore();

  if (pendingInvitations === 0) {
    return <div />;
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    open(`${endpoint()}/settings/collaboration`);
  }

  return (
    <div
      className="py-2 px-2 flex justify-between items-center bg-gray-200 cursor-pointer hover:underline text-sm text-gray-600"
      onClick={handleClick}
    >
      Pending invitations:
      <Chip color="primary" size="sm">
        {pendingInvitations}
      </Chip>
    </div>
  );
}
