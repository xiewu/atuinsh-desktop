import {
  Modal,
  ModalContent,
  Button,
  Switch,
  useDisclosure,
  Card,
  CardBody,
  CardHeader,
  Divider,
} from "@nextui-org/react";

import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { KVStore } from "@/state/kv";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";

const completeOnboarding = async () => {
  let db = await KVStore.open_default();
  await db.set("onboarding_complete", true);
};

const FeatureCard = ({ title, description }: any) => (
  <Card>
    <CardBody>
      <h4 className="text-lg font-semibold mb-2">{title}</h4>
      <p className="text-sm text-gray-600">{description}</p>
    </CardBody>
  </Card>
);

const Onboarding = () => {
  let {
    isOpen: isOnboardingOpen,
    onOpen: onOnboardingOpen,
    onOpenChange: onOnboardingOpenChange,
  } = useDisclosure();

  const [trackingOptIn, setTrackingOptIn] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);

  useEffect(() => {
    onOnboardingOpen();
  }, []);

  const close = async (onClose: any) => {
    onClose();

    await completeOnboarding();

    if (restartNeeded) {
      const yes = await ask(
        "To apply your changes, Atuin needs to restart. This won't take long!",
        {
          title: "Restart now?",
          kind: "info",
          okLabel: "Restart now",
          cancelLabel: "I'll do it later",
        },
      );
      if (yes) relaunch();
    }
  };

  return (
    <Modal
      isDismissable={false}
      hideCloseButton
      isOpen={isOnboardingOpen}
      onOpenChange={onOnboardingOpenChange}
      className="w-full select-none"
      size="2xl"
    >
      <ModalContent className="w-full">
        {(onClose) => (
          <div className="max-w-[900px] mx-auto p-6 space-y-6">
            <h1 className="text-4xl font-bold text-center">
              Welcome to Atuin Desktop
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FeatureCard
                title="Runbooks that Run"
                description="Create and run notebooks that integrate seamlessly with your infrastructure"
              />
              <FeatureCard
                title="Shell History Explorer"
                description="Easily search and analyze your past commands"
              />
            </div>

            <Card>
              <CardHeader className="flex gap-3">
                <div className="flex flex-col">
                  <p className="text-md">Getting Started</p>
                </div>
              </CardHeader>
              <Divider />
              <CardBody>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    Click the{" "}
                    <Icon
                      className="inline-block"
                      icon="solar:notebook-linear"
                    />{" "}
                    icon to start working with Runbooks
                  </li>
                  <li>
                    Use the{" "}
                    <Icon
                      className="inline-block"
                      icon="solar:history-outline"
                    />{" "}
                    icon to explore your shell history
                  </li>
                  <li>
                    Join the{" "}
                    <a
                      href="https://dub.sh/atuin-desktop-beta"
                      target="_blank"
                      className="text-blue-400 underline"
                    >
                      community
                    </a>{" "}
                    to get help and share feedback
                  </li>
                </ul>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="gap-4">
                <h2 className="text-xl font-bold">Usage Tracking</h2>
                <p className="text-gray-600">
                  To help improve Atuin, we'd like to collect anonymous usage
                  data and error reports. We respect your privacy and only track
                  with your permission.
                </p>
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Enable tracking</p>
                  <Switch
                    isSelected={trackingOptIn}
                    onValueChange={(value) => {
                      (async () => {
                        let db = await KVStore.open_default();
                        await db.set("usage_tracking", value);

                        // Regardless, restart. While we could remove all hooks when tracking is disabled, it's safer
                        // to just restart the app and never initialize the hooks at all.
                        setRestartNeeded(true);
                      })();

                      setTrackingOptIn(value);
                    }}
                    aria-label="Toggle tracking"
                  />
                </div>
                {trackingOptIn && (
                  <p className="text-sm text-gray-500">
                    Thank you for helping us improve Atuin. You can change this
                    setting anytime.
                  </p>
                )}
                {!trackingOptIn && (
                  <p className="text-sm text-gray-500">
                    Tracking is disabled. No data will be collected.
                  </p>
                )}
              </CardBody>
            </Card>

            <Button
              color="success"
              className="w-full"
              onClick={() => close(onClose)}
            >
              Get Started
            </Button>
          </div>
        )}
      </ModalContent>
    </Modal>
  );
};

export default Onboarding;
