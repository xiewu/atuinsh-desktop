import { Card, CardBody, CardHeader } from "@heroui/react";

export default function LoggedOut() {
  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="uppercase text-gray-500">Log in to share</h2>
      </CardHeader>
      <CardBody>
        <p>Log in to share your runbook and manage collaborators.</p>
      </CardBody>
    </Card>
  );
}
