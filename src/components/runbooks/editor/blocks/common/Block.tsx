import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
} from "@nextui-org/react";

interface BlockProps {
  title: string;
  header?: any;
  footer?: any;
  children: any;
  inlineHeader?: boolean;
}

export default function Block({ title, header, children, footer, inlineHeader }: BlockProps) {
  return (
    <Card
      className="w-full !max-w-full !outline-none"
      shadow="sm"
    >
      <CardHeader className="p-3 gap-2 bg-default-50 flex flex-col items-start justify-start z-auto">
        {!inlineHeader &&
          <div className="flex flex-row justify-between w-full">
            <h1 className="text-default-700 font-semibold">{title}</h1>
          </div>
        }

        {(header) && header}
      </CardHeader>

      {children &&
        <CardBody>
          {children}
        </CardBody>
      }

      {footer &&
        <CardFooter>
          {footer}
        </CardFooter>
      }

    </Card>
  );
}
