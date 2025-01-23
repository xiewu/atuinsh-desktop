import { ValueEncoder } from "ts-tiny-activerecord"

export const DateEncoder: ValueEncoder<Date, number> = {
  encode: (value) => value.getTime() * 1000000,
  decode: (value) => new Date(value / 1000000)
}

export const JSONEncoder: ValueEncoder<any, string> = {
  encode: (value) => JSON.stringify(value),
  decode: (value) => JSON.parse(value)
}
