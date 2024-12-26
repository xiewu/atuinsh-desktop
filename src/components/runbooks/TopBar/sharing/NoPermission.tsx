import { Card, CardBody, CardHeader } from "@nextui-org/react";

export default function NoPermission() {
  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="uppercase text-gray-500">Insufficient permissions</h2>
      </CardHeader>
      <CardBody>
        <p>You do not have appropriate permission to edit this runbook's settings.</p>
      </CardBody>
    </Card>
  );
}
