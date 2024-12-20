import {
  blocknoteToAtuin,
  atuinToBlocknote,
  removePrivateProps,
} from "./convert";
import { expect, test } from "vitest";

test("private props are removed correctly", () => {
  // Don't test every type of prop, just that the mechanism itself actually works
  let block = {
    id: "b339887e-746a-4d2c-b344-cee575cda742",
    type: "run",
    props: {
      type: "bash",
      body: "Here\nis\na\nscript",
      pty: "",
      global: false,
    },
    children: [],
  };

  let publicProps = removePrivateProps("@core/terminal", block.props);
  expect(publicProps).toEqual({
    body: "Here\nis\na\nscript",
  });
});

test("convert run block correctly to Atuin format", () => {
  let doc = [
    {
      id: "b339887e-746a-4d2c-b344-cee575cda742",
      type: "run",
      props: {
        type: "bash",
        code: "Here\nis\na\nscript",
        pty: "",
        global: false,
      },
      children: [],
    },
  ];

  let atuinFormat = blocknoteToAtuin(doc);
  expect(atuinFormat).toEqual([
    {
      id: "b339887e-746a-4d2c-b344-cee575cda742",
      type: "@core/terminal",
      props: {
        body: "Here\nis\na\nscript",
      },
      children: [],
    },
  ]);
});

test("convert @core/terminal correctly to Blocknote format", () => {
  let doc = [
    {
      id: "b339887e-746a-4d2c-b344-cee575cda742",
      type: "@core/terminal",
      props: {
        body: "Here\nis\na\nscript",
      },
      children: [],
    },
  ];

  let atuinFormat = atuinToBlocknote(doc);
  expect(atuinFormat).toEqual([
    {
      id: "b339887e-746a-4d2c-b344-cee575cda742",
      type: "run",
      props: {
        code: "Here\nis\na\nscript",
      },
      children: [],
    },
  ]);
});

// because we should not mutate our inputs
// It is wild that this is possible.
test("@core/terminal block round trip test", () => {
  let doc = [
    {
      id: "b339887e-746a-4d2c-b344-cee575cda742",
      type: "run",
      props: {
        type: "bash",
        code: "Here\nis\na\nscript",
        pty: "",
        global: false,
      },
      children: [],
    },
  ];

  let atuinFormat = blocknoteToAtuin(doc);
  let blocknoteFormat = atuinToBlocknote(atuinFormat);
  expect(blocknoteFormat).toStrictEqual([
    {
      ...doc[0],
      props: {
        code: "Here\nis\na\nscript",
      },
    },
  ]);
});
