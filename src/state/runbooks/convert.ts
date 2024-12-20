// We're using some older type names that need mapping before they are exposed
const TYPE_MAPPINGS = {
  run: "@core/terminal",
  clickhouse: "@core/clickhouse",
  http: "@core/http",
  editor: "@core/editor",
  postgres: "@core/postgres",
  prometheus: "@core/prometheus",
  sqlite: "@core/sqlite",
  env: "@core/env",
  directory: "@core/directory",
} as const;

// The props that should be exposed in the exported markdown
const PUBLIC_PROPS = {
  "@core/terminal": [],
  "@core/clickhouse": ["uri", "autoRefresh"],
  "@core/postgres": ["uri", "autoRefresh"],
  "@core/sqlite": ["uri", "autoRefresh"],
  "@core/prometheus": ["autoRefresh"],
  "@core/editor": ["language"],
  "@core/http": ["url", "verb", "headers"],
} as const;

// Props that should be parsed from a string -> object before passing through
const PARSE_PROPS = {
  "@core/http": ["headers"],
} as const;

// We have the concept of a "body" in our markdown. While blocknote uses props for most useful
// data storage, we have a magic "body" prop that is set as the main body for a markdown code
// block.
// Detail which prop should be used for the body of the block in markdown
const BODY_MAP: { [K in `@core/${string}`]: (props: any) => string } = {
  "@core/terminal": (props) => props.code,
  "@core/prometheus": (props) => props.query,
  "@core/sqlite": (props) => props.query,
  "@core/postgres": (props) => props.query,
  "@core/clickhouse": (props) => props.query,
  "@core/editor": (props) => props.code,
  "@core/directory": (props) => props.path,
  "@core/env": (props) => {
    return `${props.name}=${props.value}`;
  },
} as const;

// Remove all props that should not end up outside of the Runbooks environment
export function removePrivateProps(blockType: string, input: any): any {
  let props = structuredClone(input);

  // delete any props not in the public props list, for @ blocks
  if (blockType.startsWith("@")) {
    for (let prop in props) {
      // @ts-ignore
      if (!PUBLIC_PROPS[blockType]?.includes(prop) && prop !== "body") {
        delete props[prop];
      }
    }
  }

  return props;
}

export function blocknoteToAtuin(content: any[]): any {
  const processBlock = (input: any) => {
    const block = structuredClone(input);

    if (block.type in TYPE_MAPPINGS) {
      // @ts-ignore
      block.type = TYPE_MAPPINGS[block.type];
    }

    if (block.type in BODY_MAP) {
      block.props.body = BODY_MAP[block.type](block.props);
    }

    block.props = removePrivateProps(block.type, block.props);

    if (block.content) {
      // If the block content is an object rather than a list, rewrite it to be a list with one element
      if (!Array.isArray(block.content)) {
        block.content = [block.content];
      }
    }

    let newChildren = block.children.map(processBlock);
    block.children = newChildren;

    return block;
  };

  return content.map(processBlock);
}

// Reverse mapping of types from Atuin back to Blocknote
const REVERSE_TYPE_MAPPINGS = Object.entries(TYPE_MAPPINGS).reduce(
  (acc, [key, value]) => ({
    ...acc,
    [value]: key,
  }),
  {} as {
    [K in (typeof TYPE_MAPPINGS)[keyof typeof TYPE_MAPPINGS]]: keyof typeof TYPE_MAPPINGS;
  },
);

// Reverse body mapping to extract the original props
const REVERSE_BODY_MAP: {
  [K in keyof typeof BODY_MAP]: (body: string) => Partial<any>;
} = {
  "@core/terminal": (body) => ({ code: body }),
  "@core/prometheus": (body) => ({ query: body }),
  "@core/sqlite": (body) => ({ query: body }),
  "@core/postgres": (body) => ({ query: body }),
  "@core/clickhouse": (body) => ({ query: body }),
  "@core/editor": (body) => ({ code: body }),
  "@core/directory": (body) => ({ path: body.replace(/^cd /, "") }),
  "@core/env": (body) => {
    const [name, value] = body.split("=", 2);
    return { name, value };
  },
};

export function atuinToBlocknote(content: any[]): any {
  const processContent = (content: any) => {
    const newContent = { ...content };

    if (newContent.type === "text") {
      if (!newContent.styles) newContent.styles = {};
    }

    return newContent;
  };

  const processBlock = (block: any) => {
    const newBlock = { ...block };

    // Convert type back to Blocknote format if it's an @ block
    if (block.type in REVERSE_TYPE_MAPPINGS) {
      newBlock.type = REVERSE_TYPE_MAPPINGS[block.type];
    }

    // If there's a body property and a reverse body mapping exists,
    // extract the original props
    if (newBlock.props.body && block.type in REVERSE_BODY_MAP) {
      const extractedProps = REVERSE_BODY_MAP[block.type](newBlock.props.body);
      newBlock.props = {
        ...newBlock.props,
        ...extractedProps,
      };
      delete newBlock.props.body;
    }

    for (let prop in newBlock.props) {
      if (typeof newBlock.props[prop] === "object") {
        newBlock.props[prop] = JSON.stringify(newBlock.props[prop]);
      }
    }

    // Process content recursively if it exists
    if (newBlock.content) {
      newBlock.content = newBlock.content.map(processContent);

      if (newBlock.type === "table") {
        if (
          newBlock.content.length === 1 &&
          newBlock.content[0].type === "tableContent"
        ) {
          newBlock.content = newBlock.content[0];
        }
      }
    }

    let newChildren = block.children.map(processBlock);
    newBlock.children = newChildren;

    return newBlock;
  };

  return content.map(processBlock);
}
