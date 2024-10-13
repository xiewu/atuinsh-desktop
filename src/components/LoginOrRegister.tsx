import { useState } from "react";

import { useStore } from "@/state/store";
import { Input, Button } from "@nextui-org/react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { register, login } from "@/api/api";
import { invoke } from "@tauri-apps/api/core";

const savePassword = async (service: string, user: string, value: string) => {
  if (import.meta.env.MODE === "development") {
    localStorage.setItem(`${service}:${user}`, value);
    return;
  }

  return await invoke("save_password", { service, user, value });
};

interface RegisterProps {
  toggle: () => void;
  onClose: () => void;
}

function Register(props: RegisterProps) {
  const refreshUser = useStore((state) => state.refreshUser);
  const [errors, setErrors] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const toggleVisibility = () => setIsVisible(!isVisible);
  const toggleConfirmVisibility = () => setIsConfirmVisible(!isConfirmVisible);

  const doRegister = () => {
    (async () => {
      if (username === "" || email === "" || password === "" || confirmPassword === "") {
        setErrors("Please fill out all required fields");
        return;
      }

      if (password !== confirmPassword) {
        setErrors("Your passwords do not match. Please try again");
        return;
      }

      let resp = await register(username, email, password);

      if (resp.status === 201) {
        setErrors(null);
        let json = await resp.json();
        let token = json["token"];
        await savePassword("sh.atuin.runbooks.api", username, token);

        localStorage.setItem("username", username);
        props.onClose();

        await refreshUser();
        return;
      }

      if (resp.status >= 500) {
        setErrors("An error occurred. Please try again later.");
        return;
      }

      let error: any = await resp.json();
      setErrors(error["error"]);
    })();
  };

  return (
    <>
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-large px-4 pb-6 pt-4">
          <p className="pb-4 text-left text-3xl font-semibold">
            Sign Up
          </p>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <Input
              isRequired
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              label="Username"
              name="username"
              placeholder="Enter your username"
              type="text"
              variant="bordered"
              value={username}
              onValueChange={setUsername}
            />
            <Input
              isRequired
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              label="Email"
              name="email"
              placeholder="Enter your email"
              type="email"
              variant="bordered"
              value={email}
              onValueChange={setEmail}
            />
            <Input
              isRequired
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              endContent={
                <button type="button" onClick={toggleVisibility} tabIndex={-1}>
                  {isVisible ? (
                    <EyeOffIcon />
                  ) : (
                    <EyeIcon />
                  )}
                </button>
              }
              label="Password"
              name="password"
              placeholder="Enter your password"
              type={isVisible ? "text" : "password"}
              variant="bordered"
              value={password}
              onValueChange={setPassword}
            />
            <Input
              isRequired
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              endContent={
                <button type="button" onClick={toggleConfirmVisibility} tabIndex={-1}>
                  {isConfirmVisible ? (
                    <EyeOffIcon />
                  ) : (
                    <EyeIcon />
                  )}
                </button>
              }
              label="Confirm Password"
              name="confirmPassword"
              placeholder="Confirm your password"
              type={isConfirmVisible ? "text" : "password"}
              variant="bordered"
              value={confirmPassword}
              onValueChange={setConfirmPassword}
            />
            <Button color="primary" type="submit" onPress={doRegister}>
              Sign Up
            </Button>
          </form>
          <a className="text-center text-small hover:cursor-pointer" onClick={(e) => {
            e.preventDefault();
            props.toggle();
          }}>
            Already have an account? <span className="text-green-500">Log In</span>
          </a>

          {errors && <p className="text-small text-red-500 text-center">{errors}</p>}
        </div>
      </div>
    </>
  );
}

function Login(props: any) {
  const refreshUser = useStore((state) => state.refreshUser);
  const [errors, setErrors] = useState<string | null>(null);

  const [isVisible, setIsVisible] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const toggleVisibility = () => setIsVisible(!isVisible);

  const doLogin = async () => {
    if (username === "" || password === "") {
      setErrors("Please fill out all required fields");
      return;
    }

    let resp = await login(username, password);

    if (resp.status === 200) {
      setErrors(null);
      let json = await resp.json();
      let token = json["token"];
      await savePassword("sh.atuin.runbooks.api", username, token);
      localStorage.setItem("username", username);
      props.onClose();

      await refreshUser();

      return;
    }

    if (resp.status >= 500) {
      setErrors("An error occurred. Please try again later.");
      return;
    }

    let error: any = await resp.json();
    setErrors(error["error"]);
  };

  return (
    <>
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-large px-4 pb-6 pt-4">
          <p className="pb-4 text-left text-3xl font-semibold">
            Login
          </p>
          <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
            <Input
              isRequired
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              label="Username"
              name="username"
              placeholder="Enter your username"
              type="text"
              variant="bordered"
              value={username}
              onValueChange={setUsername}
            />
            <Input
              isRequired
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
              endContent={
                <button type="button" onClick={toggleVisibility} tabIndex={-1}>
                  {isVisible ? (
                    <EyeOffIcon />
                  ) : (
                    <EyeIcon />
                  )}
                </button>
              }
              label="Password"
              name="password"
              placeholder="Enter your password"
              type={isVisible ? "text" : "password"}
              variant="bordered"
              value={password}
              onValueChange={setPassword}
            />
            <Button color="primary" type="submit" onPress={doLogin}>
              Login
            </Button>
          </form>
          <a className="text-center text-small hover:cursor-pointer" onClick={(e) => {
            e.preventDefault();
            props.toggle();
          }}>
            No account yet? <span className="text-green-500">Sign up</span>
          </a>

          {errors && <p className="text-small text-red-500 text-center">{errors}</p>}
        </div>
      </div>
    </>
  );
}

export default function LoginOrRegister({ onClose }: { onClose: () => void }) {
  let [login, setLogin] = useState<boolean>(false);

  if (login) {
    return <Login onClose={onClose} toggle={() => setLogin(false)} />;
  }

  return <Register onClose={onClose} toggle={() => setLogin(true)} />;
}
