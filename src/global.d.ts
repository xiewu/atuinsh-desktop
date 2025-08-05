declare global {
  type Timeout = ReturnType<typeof setTimeout>;
  type Interval = ReturnType<typeof setInterval>;

  type Option<T> = import("@binarymuse/ts-stdlib").Option<T>;
  type Result<T, E> = import("@binarymuse/ts-stdlib").Result<T, E>;

  var Some: <T>(value: T) => import("@binarymuse/ts-stdlib").Option<T>;
  var None: import("@binarymuse/ts-stdlib").Option<any>;
  var Ok: <T>(value: T) => import("@binarymuse/ts-stdlib").Result<T, never>;
  var Err: <E>(error: E) => import("@binarymuse/ts-stdlib").Result<never, E>;
}

// This export is required to make this a module
export {};
