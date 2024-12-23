import { Card, CardBody, CardHeader } from "@nextui-org/react";

export default function LoggedOut() {
  return (
    <Card className="w-96">
      <CardHeader>
        <h2 className="uppercase text-gray-500">Log in to share</h2>
      </CardHeader>
      <CardBody>
        <p>Log in to share your runbook and manage collaborators.</p>
      </CardBody>
    </Card>
  );
}
