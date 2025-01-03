export function autobind(
  _target: any,
  key: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  let fn = descriptor.value;

  if (typeof fn !== "function") {
    throw new Error("Only methods can be autobound");
  }

  return {
    configurable: true,
    get() {
      const bound = fn.bind(this);
      // memoize the bound function on first get
      Object.defineProperty(this, key, {
        configurable: true,
        get() {
          return bound;
        },
        // reset memoization if the function is reassigned
        set(value) {
          fn = value;
          delete this[key];
        },
      });
      return bound;
    },
    set(value: Function) {
      fn = value;
    },
  };
}
