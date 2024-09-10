import { Card, CardBody, CardHeader, Chip } from "@nextui-org/react";
import { CircleXIcon } from "lucide-react";

const ErrorCard = ({ error }: any) => {
  return (
    <Card shadow="sm" className="w-full max-w-full border border-danger-200">
      <CardHeader className="flex justify-between items-center bg-danger-50">
        <div className="flex items-center gap-3">
          <Chip
            color="danger"
            variant="flat"
            startContent={<CircleXIcon size={14} />}
            className="pl-3 py-2"
          >
            Error
          </Chip>
          <span className="text-danger-700 font-semibold">
            Prometheus error
          </span>
        </div>
      </CardHeader>
      <CardBody className="p-4">
        <p className="text-danger-600 select-text">
          {error ||
            "An error occurred while making the request. Please check your connection and try again."}
        </p>
      </CardBody>
    </Card>
  );
};

export default ErrorCard;
