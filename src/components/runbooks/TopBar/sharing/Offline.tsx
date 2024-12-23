import { Card, CardBody, CardHeader } from "@nextui-org/react";

export default function Offline() {
  return (
    <Card className="w-96">
      <CardHeader>
        <h2 className="uppercase text-gray-500">You are offline</h2>
      </CardHeader>
      <CardBody>
        <p>Go online to connect to Atuin Hub and manage your runbook settings and collaborators.</p>
      </CardBody>
    </Card>
  );
}
