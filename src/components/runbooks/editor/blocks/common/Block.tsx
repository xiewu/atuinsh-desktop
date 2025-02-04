import EditableHeading from "@/components/EditableHeading";
import { Card, CardHeader, CardBody, CardFooter, cn } from "@heroui/react";

interface BlockProps {
  name: string;
  setName: (name: string) => void;

  header?: any;
  footer?: any;
  children: any;
  inlineHeader?: boolean;
  hideChild?: boolean;
}

export default function Block({
  name,
  setName,
  header,
  children,
  footer,
  inlineHeader,
  hideChild,
}: BlockProps) {
  return (
    <Card className="w-full !max-w-full !outline-none" shadow="sm">
      <CardHeader className="p-3 gap-2 bg-default-50 flex flex-col items-start justify-start z-auto">
        {!inlineHeader && (
          <div className="flex flex-row justify-between w-full">
            <EditableHeading initialText={name} onTextChange={setName} />
          </div>
        )}

        {header && header}
      </CardHeader>

      {children && <CardBody className={cn({"hidden": hideChild})}>{children}</CardBody>}

      {footer && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
