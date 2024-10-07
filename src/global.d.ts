type Option<T> = Some<T> | None;

interface Some<T> {
  readonly _tag: 'Some';
  readonly value: T;
}

interface None {
  readonly _tag: 'None';
}

// Extend Option<T> interface with our methods
interface Option<T> {
  unwrap(): T;
  unwrapOr(defaultValue: T): T;
  map<U>(fn: (value: T) => U): Option<U>;
  isSome(): this is Some<T>;
  isNone(): this is None;
}

// Implementation
function Some<T>(value: T): Option<T> {
  const option: Option<T> = {
    _tag: 'Some',
    value,
    unwrap() {
      return this.value;
    },
    unwrapOr(defaultValue: T) {
      return this.value;
    },
    map<U>(fn: (value: T) => U) {
      return Some(fn(this.value));
    },
    isSome() {
      return true;
    },
    isNone() {
      return false;
    }
  };
  return option;
}

const None: Option<never> = {
  _tag: 'None',
  unwrap() {
    throw new Error("Tried to unwrap None value");
  },
  unwrapOr<T>(defaultValue: T) {
    return defaultValue;
  },
  map() {
    return None;
  },
  isSome() {
    return false;
  },
  isNone() {
    return true;
  }
};
