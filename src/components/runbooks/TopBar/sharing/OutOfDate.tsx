import { Card, CardBody, CardHeader } from "@heroui/react";
import { Button } from "@heroui/react";

interface OutOfDateProps {
  currentVersion: string;
  minimumVersion: string;
}

export default function OutOfdate({ currentVersion, minimumVersion }: OutOfDateProps) {
  function checkForUpdates() {
    window.dispatchEvent(new Event("update-check"));
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="uppercase text-gray-500">Update Required</h2>
      </CardHeader>
      <CardBody className="flex flex-col gap-2">
        <p>
          Your version of Atuin Desktop is out of date and needs to be updated to connect to
          AtuinHub.
        </p>
        <p>
          You are using version <span className="font-semibold">{currentVersion}</span> and the
          minimum version is <span className="font-semibold">{minimumVersion}</span>.
        </p>
        <div>
          <Button variant="flat" color="primary" onPress={() => checkForUpdates()}>
            Check for updates
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
