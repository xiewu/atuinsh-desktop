import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  useDisclosure,
} from "@nextui-org/react";
import { useEffect, useState } from "react";
import HorizontalSteps from "./horizontal-steps";
import { Icon } from "@iconify/react";
import { invoke } from "@tauri-apps/api/core";
import LoginOrRegister from "../LoginOrRegister";
import { useStore } from "@/state/store";
import { KVStore } from "@/state/kv";

const completeOnboarding = async () => {
  let db = await KVStore.open();
  await db.set("onboarding_complete", true);
};

const Onboarding = () => {
  const user = useStore((state) => state.user);

  let {
    isOpen: isOnboardingOpen,
    onOpen: onOnboardingOpen,
    onOpenChange: onOnboardingOpenChange,
  } = useDisclosure();

  let {
    isOpen: isRegisterOpen,
    onOpen: onRegisterOpen,
    onOpenChange: onRegisterOpenChange,
  } = useDisclosure();

  const [currentStep, setCurrentStep] = useState(0);
  const [isCliInstalled, setIsCliInstalled] = useState(false);
  const [installInProgress, setInstallInProgress] = useState(false);
  const [justInstalled, setJustInstalled] = useState(false);

  useEffect(() => {
    onOnboardingOpen();
    (async () => {
      let cliInstalled = await invoke<boolean>("is_cli_installed");
      setIsCliInstalled(cliInstalled);
    })();
  }, []);

  const steps = [
    { title: <div>Welcome</div> },
    { title: "Install CLI" },
    { title: "Register" },
    { title: "Opt-in" },
  ];

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
                    <p>
                      Welcome to Atuin! This is a quick onboarding guide to get
                      you started
                    </p>
                    <p>
                      While Atuin works best with the CLI installed, you can use
                      Runbooks without it{" "}
                    </p>
                    <p>
                      Select the{" "}
                      <Icon className="inline" icon="solar:notebook-linear" />{" "}
                      on the sidebar to get started with Runbooks
                    </p>
                  </>
                )}

                {currentStep == 1 && (
                  <>
                    {isCliInstalled && (
                      <>
                        <p>
                          {justInstalled ? (
                            <>Atuin CLI installed!</>
                          ) : (
                            <>
                              Looks like you already have the Atuin CLI.
                              Fantastic!
                            </>
                          )}
                        </p>
                        <p>
                          Browse your history with the{" "}
                          <Icon
                            className="inline"
                            icon="solar:history-outline"
                          />{" "}
                          on the sidebar
                        </p>
                      </>
                    )}
                    {!isCliInstalled && (
                      <>
                        <p>
                          We couldn't find the Atuin CLI installed on your
                          system
                        </p>
                        <p>
                          It's not required to use Runbooks, but provides
                          several enhancements - such as better shell history
                        </p>
                        <Button
                          variant="shadow"
                          isLoading={installInProgress}
                          onPress={async () => {
                            setInstallInProgress(true);
                            console.log("Installing CLI...");
                            await invoke("install_cli");

                            console.log("Setting up plugin...");
                            await invoke("setup_cli");

                            setIsCliInstalled(true);
                            setInstallInProgress(false);
                            setJustInstalled(true);
                          }}
                        >
                          Install CLI
                        </Button>
                      </>
                    )}
                  </>
                )}

                {currentStep == 2 && (
                  <>
                    {!user.username && (
                      <>
                        <p>
                          Optionally registering with Atuin allows you to sync
                          and backup your shell history across devices
                        </p>
                        <p>
                          Your commands are end-to-end encrypted and only
                          accessible by you
                        </p>

                        <Button
                          variant="shadow"
                          onPress={async () => {
                            onRegisterOpen();
                          }}
                        >
                          Register
                        </Button>
                      </>
                    )}

                    {user.username && (
                      <>
                        <p>
                          You're already registered as{" "}
                          <span>@{user.username}</span>!
                        </p>
                      </>
                    )}
                  </>
                )}

                {currentStep == 3 && (
                  <p>
                    There's currently nothing to opt-in to, but soon this will
                    have error reporting and analytics
                  </p>
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
                    }

                    await completeOnboarding();
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

      <Modal
        isOpen={isRegisterOpen}
        onOpenChange={onRegisterOpenChange}
        className="w-full p-8"
      >
        <ModalContent className="w-full">
          {(onClose) => (
            <>
              <LoginOrRegister onClose={onClose} />
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default Onboarding;
