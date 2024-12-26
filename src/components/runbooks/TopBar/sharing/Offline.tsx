import { Card, CardBody, CardHeader } from "@nextui-org/react";

export default function Offline() {
  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="uppercase text-gray-500">No Connection</h2>
      </CardHeader>
      <CardBody>
        <p>
          Cannot connect to Atuin Hub. The site may be down, or you may not be connected to the
          internet.
        </p>
      </CardBody>
    </Card>
  );
}
