import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  cn,
  useDisclosure,
} from "@nextui-org/react";

import { useEffect, useState } from "react";
import HorizontalSteps from "./horizontal-steps";
import { Icon } from "@iconify/react";
import { KVStore } from "@/state/kv";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";

const completeOnboarding = async () => {
  let db = await KVStore.open_default();
  await db.set("onboarding_complete", true);
};

const Onboarding = () => {
  let {
    isOpen: isOnboardingOpen,
    onOpen: onOnboardingOpen,
    onOpenChange: onOnboardingOpenChange,
  } = useDisclosure();

  const [currentStep, setCurrentStep] = useState(0);
  const [trackingOptIn, setTrackingOptIn] = useState(false);
  const [restartNeeded, setRestartNeeded] = useState(false);

  useEffect(() => {
    onOnboardingOpen();
  }, []);

  const steps = [{ title: <div>Welcome</div> }, { title: "Opt-in" }];

  return (
    <>
      <Modal
        isDismissable={false}
        hideCloseButton
        isOpen={isOnboardingOpen}
        onOpenChange={onOnboardingOpenChange}
        className="w-full"
      >
        <ModalContent className="w-full">
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 w-full">
                <HorizontalSteps
                  className="w-full"
                  currentStep={currentStep}
                  onStepChange={setCurrentStep}
                  steps={steps}
                  hideProgressBars
                />
              </ModalHeader>
              <ModalBody>
                {currentStep == 0 && (
                  <>
                    <p>Welcome to Atuin!</p>
                    <p>
                      While Atuin works best with the `atuin` CLI installed, you
                      can use Runbooks without it{" "}
                    </p>
                    <p>
                      Select the{" "}
                      <Icon className="inline" icon="solar:notebook-linear" />{" "}
                      on the sidebar to get started with Runbooks
                    </p>
                  </>
                )}

                {currentStep == 1 && (
                  <div>
                    <h2 className="text-xl text-center pb-1">
                      Opt-in to help us make Atuin better!
                    </h2>

                    <p className="text-xs text-center pb-4">
                      By default, Atuin collects no data. However, if you
                      opt-in, we collect data to help us improve the product.
                    </p>

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
                      classNames={{
                        base: cn(
                          "inline-flex flex-row-reverse w-full max-w-md bg-content1 hover:bg-content2 items-center",
                          "justify-between cursor-pointer rounded-lg gap-2 p-4 border-2 border-transparent",
                          "data-[selected=true]:border-primary",
                        ),
                        wrapper: "p-0 h-4 overflow-visible",
                        thumb: cn(
                          "w-6 h-6 border-2 shadow-lg",
                          "group-data-[hover=true]:border-primary",
                          //selected
                          "group-data-[selected=true]:ml-6",
                          // pressed
                          "group-data-[pressed=true]:w-7",
                          "group-data-[selected]:group-data-[pressed]:ml-4",
                        ),
                      }}
                    >
                      <div className="flex flex-col gap-1">
                        <p className="text-medium">Enable usage tracking</p>
                        <p className="text-tiny text-default-400">
                          Track usage and errors
                        </p>
                      </div>
                    </Switch>

                    <p className="text-tiny text-default-400 mt-4 text-center">
                      You can change these settings at any time in the settings
                      menu. We never share your terminal data.
                    </p>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                {currentStep < steps.length - 1 && (
                  <Button
                    color="danger"
                    variant="light"
                    onPress={async () => {
                      await completeOnboarding();
                      onClose();
                    }}
                  >
                    Skip onboarding
                  </Button>
                )}
                <Button
                  color="primary"
                  onPress={async () => {
                    if (currentStep < steps.length - 1) {
                      setCurrentStep(currentStep + 1);
                    } else {
                      onClose();

                      await completeOnboarding();

                      if (restartNeeded) {
                        const yes = await ask(
                          `
                          To apply your changes, Atuin needs to restart. This won't take long!
                          `,
                          {
                            title: "Restart now?",
                            kind: "info",
                            okLabel: "Restart now",
                            cancelLabel: "Restart later",
                          },
                        );
                        if (yes) relaunch();
                      }
                    }
                  }}
                >
                  {currentStep < steps.length - 1 && "Next"}
                  {currentStep == steps.length - 1 && "Finish"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default Onboarding;
