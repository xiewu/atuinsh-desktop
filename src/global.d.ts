declare global {
  type Timeout = ReturnType<typeof setTimeout>;
  type Interval = ReturnType<typeof setInterval>;

  type Option<T> = import("@binarymuse/ts-stdlib").Option<T>;
  type Result<T, E> = import("@binarymuse/ts-stdlib").Result<T, E>;

  var Some = import("@binarymuse/ts-stdlib").Some;
  var None = import("@binarymuse/ts-stdlib").None;
  var Ok = import("@binarymuse/ts-stdlib").Ok;
  var Err = import("@binarymuse/ts-stdlib").Err;
}

// This export is required to make this a module
export {};
