import Runbook from "@/state/runbooks/runbook";
import { Button, Card, CardBody, CardHeader, Input } from "@nextui-org/react";

interface PublishProps {
  runbook: Runbook;
  slug?: string;
  setSlug: (slug: string) => void;
  error?: string;
}

export default function Publish(props: PublishProps) {
  return (
    <Card className="w-96">
      <CardHeader>
        <h2 className="uppercase text-gray-500">Share to Hub</h2>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Input
            label="slug"
            variant="bordered"
            value={props.slug}
            onValueChange={props.setSlug}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
          />
          {props.error && <div className="text-red-600 italic text-sm">{props.error}</div>}
          {/* <p
              className={cn("text-red-600 italic text-sm", {
                hidden: slugAvailable,
              })}
            >
              Slug already in use
            </p>
            <p
              className={cn("text-xs text-gray-500 italic", {
                hidden: !slugAvailable || success,
              })}
            >
              Runbook will be live at {user.username}/{slugify(slug)}
            </p>

            <p
              className={cn("text-xs text-gray-500 italic", {
                hidden: !success,
              })}
            >
              Runbook is live at{" "}
              <a target="_blank" href={`${endpoint()}/${user.username}/${slugify(slug)}`}>
                {user.username}/{slugify(slug)}
              </a>
            </p> */}
        </div>
        <div className="flex flex-row">
          {/* <VisibilityDropdown onValueChange={setVisibility} /> */}
          <Button
            // disabled={!props.slugAvailable || props.success}
            disabled={true}
            size="sm"
            className="flex-grow"
            variant="flat"
            color="success"
            onClick={() => {
              // if (!slug) return;
              // shareRunbook(runbook, slug, visibility, () => setSuccess(true));
            }}
          >
            Push to Hub
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
