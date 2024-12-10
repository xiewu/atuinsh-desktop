// Abstract the markdown parsing a bit. Most of the logic for creating a runbook lives in the
// runbook struct, but let's not also cram lots of markdown in there. That would be gross.
//
//
// Ok this is also pretty gross.

use std::cell::RefCell;
use std::fmt::Write;

use comrak::arena_tree::Node;
use comrak::nodes::{Ast, AstNode, NodeCode, NodeValue};
use comrak::{parse_document, Arena, Options};
use eyre::Result;
use serde_json::{value::Value as JsonValue, Map};

use crate::runbooks::runbook::Runbook;

use super::content::{Content, RunbookContent, RunbookFrontMatter, RunbookNode};

fn collect_text<'a>(node: &'a AstNode<'a>, output: &mut String) {
    match node.data.borrow().value {
        NodeValue::Text(ref literal) | NodeValue::Code(NodeCode { ref literal, .. }) => {
            output.push_str(literal)
        }
        NodeValue::LineBreak | NodeValue::SoftBreak => output.push(' '),
        _ => {
            for n in node.children() {
                collect_text(n, output);
            }
        }
    }
}

fn parse_content<'a>(node: &'a Node<'a, RefCell<Ast>>) -> Option<Content> {
    let content = node.children().filter_map(parse_content).collect();

    match node.data.clone().into_inner().value {
        NodeValue::Text(ref literal) => Some(Content::text(literal.clone(), content)),

        NodeValue::Link(link) => Some(Content::link(link.url, content)),

        _ => None,
    }
}

fn parse_block<'a>(node: &'a Node<'a, RefCell<Ast>>) -> Result<Option<RunbookNode>> {
    match node.data.clone().into_inner().value {
        NodeValue::Heading(heading) => {
            let mut text = String::new();
            collect_text(node, &mut text);

            Ok(Some(RunbookNode::heading(text, heading.level as u16)))
        }

        NodeValue::Paragraph => {
            let content = node.children().filter_map(parse_content).collect();

            Ok(Some(RunbookNode::paragraph(content)))
        }

        NodeValue::CodeBlock(block) => {
            let block_front_matter =
                super::block_parse::parse_front_matter(block.literal.as_str())?;

            Ok(Some(RunbookNode::block(
                block.info,
                block_front_matter.metadata,
                block_front_matter.content,
            )))
        }

        _ => Ok(None),
    }
}

pub fn parse_markdown(markdown: String) -> Result<Runbook> {
    let arena = Arena::new();
    let mut options = Options::default();
    options.extension.front_matter_delimiter = Some("---".to_owned());

    let root = parse_document(&arena, markdown.as_str(), &options);

    let mut front_matter = String::new();
    let mut blocks: RunbookContent = vec![];

    // Iterate through, find the blocks!
    for node in root.descendants() {
        match node.data.clone().into_inner().value {
            NodeValue::FrontMatter(fm) => {
                front_matter = fm;
            }
            _ => {
                let block = parse_block(node)?;

                if let Some(block) = block {
                    blocks.push(block);
                }
            }
        }
    }

    // parse that frontmatter out
    let front_matter = front_matter.replace("---", "");
    let front_matter: RunbookFrontMatter = serde_yaml::from_str(front_matter.as_str())?;

    // TODO(ellie): a lot of this should be pulled from the document front matter, we just do not
    // have that yet
    // We should either pull the name from the front matter or the document
    let runbook = Runbook {
        version: front_matter.version,
        id: front_matter.id,
        name: front_matter.name,
        content: blocks,
        created: Some(time::OffsetDateTime::now_utc().unix_timestamp_nanos() as u64),
        updated: None,
    };

    Ok(runbook)
}

fn dump_content(content: Content) -> String {
    let mut out = String::new();

    match content {
        Content::Text(super::content::text::Text { text, .. }) => {
            out.push_str(text.as_str());
        }

        Content::Link(super::content::link::Link { href, content }) => {
            let text_content = content
                .into_iter()
                .map(dump_content)
                .collect::<Vec<String>>()
                .join("");

            out.push_str(format!("[{}]({})", text_content, href).as_str());
        }

        _ => unimplemented!("promise i'll get to this"),
    }

    out
}

pub fn dump_markdown(runbook: &Runbook) -> Result<String> {
    let mut out = String::new();

    // Store runbook props as front matter
    // Probably not ALL of them, just those that make the most sense
    out.push_str("---\n");

    out.push_str(&serde_yaml::to_string(&RunbookFrontMatter {
        version: runbook.version,
        id: runbook.id,
        name: runbook.name.clone(),
        authors: None,
    })?);

    out.push_str("---\n");

    for block in runbook.content.iter() {
        match block.type_.as_str() {
            "heading" => {
                let text = block.text_content();
                let level: u64 = block
                    .props
                    .get("level")
                    .map_or(1, |v| v.as_u64().unwrap_or(1));

                let level_marker = '#'.to_string().repeat(level as usize);
                out.push_str(&format!("{} {}\n", level_marker, text));
            }

            "paragraph" => {
                let str = block
                    .content
                    .clone()
                    .into_iter()
                    .map(dump_content)
                    .collect::<Vec<String>>()
                    .join("");

                out.write_str(str.as_str()).expect("Failed to write str");
                out.push('\n');
            }

            block_type if block_type.starts_with('@') => {
                // Encode the block props as YAML, and insert them at the top of the code block in
                // between front matter marks

                // filter the props to remove the "body" prop
                let block_props: Map<String, JsonValue> = block
                    .props
                    .clone()
                    .into_iter()
                    .filter(|(k, v)| k != "body" && v.as_object().map_or(true, |o| !o.is_empty()))
                    .collect();
                let props = serde_yaml::to_string(&block_props)?;

                out.push_str(format!("```{block_type}\n").as_str());

                if !block_props.is_empty() {
                    out.push_str("---\n");
                    out.push_str(&props);
                    out.push_str("---\n");
                }

                out.push_str(&block.body_content().unwrap_or_else(|| block.text_content()));
                out.push_str("\n```\n");
            }

            _ => {
                continue;
            }
        }
    }

    out.push_str("\nBuilt with [Atuin Runbooks](https://atuin.sh)");

    Ok(out)
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use crate::runbooks::{
        content::{Content, RunbookNode},
        runbook::Runbook,
    };

    use super::{dump_markdown, parse_markdown};
    use serde_json::{value::Value as JsonValue, Map, Number};
    use uuid::Uuid;

    use pretty_assertions::assert_eq;

    #[test]
    fn markdown_simple_single_header() {
        let md = r#"---
version: 0
id: 0192ff949eb674e195dd68dda19de39e
name: Test runbook
---

# Hello world
        "#;

        let rb = parse_markdown(md.to_string()).unwrap();

        assert_eq!(rb.content.len(), 1);
        assert_eq!(rb.content[0].type_, "heading");

        let first = rb.content[0]
            .content
            .first()
            .expect("runbook node has no content");

        assert!(matches!(
            first,
            Content::Text (crate::runbooks::content::text::Text{ text, .. }) if *text == String::from("Hello world")
        ));

        assert_eq!(rb.version, 0);
    }

    #[test]
    fn markdown_simple_multi_header_levels() {
        let md = r#"---
version: 0
id: 0192ff949eb674e195dd68dda19de39e
name: Test runbook
---

# Hello world
## Wassup
### Three levels
        "#;

        let rb = parse_markdown(md.to_string()).unwrap();

        assert_eq!(rb.content.len(), 3);

        assert!(matches!(
            rb.content[0].clone().content.first().expect("block has no content"),
            Content::Text (crate::runbooks::content::text::Text{ text, .. }) if *text == String::from("Hello world")
        ));

        assert_eq!(
            rb.content[0].props.get("level"),
            Some(&JsonValue::Number(Number::from_u128(1).unwrap()))
        );

        assert!(matches!(
            rb.content[1].clone().content.first().expect("block has no content"),
            Content::Text (crate::runbooks::content::text::Text{ text, .. }) if *text == String::from("Wassup")
        ));

        assert_eq!(
            rb.content[1].props.get("level"),
            Some(&JsonValue::Number(Number::from_u128(2).unwrap()))
        );

        assert!(matches!(
            rb.content[2].clone().content.first().expect("block has no content"),
            Content::Text (crate::runbooks::content::text::Text{ text, .. }) if *text == String::from("Three levels")
        ));

        assert_eq!(
            rb.content[2].props.get("level"),
            Some(&JsonValue::Number(Number::from_u128(3).unwrap()))
        );
    }

    #[test]
    fn markdown_simple_header_body() {
        let md = r#"---
version: 0
id: 0192ff949eb674e195dd68dda19de39e
name: Test runbook
---

# Hello world

This is a markdown doc
        "#;

        let rb = parse_markdown(md.to_string()).unwrap();

        assert_eq!(rb.content.len(), 2);
        assert_eq!(rb.content[0].type_, "heading");
        assert_eq!(rb.content[1].type_, "paragraph");

        assert!(matches!(
            rb.content[1].content[0].clone(),
            Content::Text { .. }
        ));
    }

    #[test]
    fn markdown_code_block() {
        let md = r#"---
version: 0
id: 0192ff949eb674e195dd68dda19de39e
name: Test runbook
---
# Testing things

First, we can run some bash. With some props!
```@core/terminal
---
foo: bar
bar:
    - one
    - two
    - three
---

echo 'foo'
echo 'bar'
sudo apt update
```

Then we can run a http request
```@core/http
---
verb: post
url: https://api.example.com
headers:
  Content-Type: application/json
  Authorization: Bearer token
params:
  foo: bar
  baz: 42
---
{"data": "content"}
```
        "#;

        let rb = parse_markdown(md.to_string()).unwrap();

        assert_eq!(rb.content.len(), 5);
        assert_eq!(rb.content[2].type_, "@core/terminal");

        assert_eq!(
            rb.content[2].props.get("foo"),
            Some(&JsonValue::String("bar".to_string()))
        );

        assert_eq!(
            rb.content[2].props.get("bar"),
            Some(&JsonValue::Array(vec![
                JsonValue::String("one".to_string()),
                JsonValue::String("two".to_string()),
                JsonValue::String("three".to_string())
            ]))
        );

        assert_eq!(rb.content[4].type_, "@core/http");

        assert_eq!(
            rb.content[4].props.get("url"),
            Some(&JsonValue::String("https://api.example.com".to_string()))
        );

        assert_eq!(rb.content[4].text_content(), "{\"data\": \"content\"}");
    }

    #[test]
    fn markdown_simple_dump() {
        let terminal_props = Map::from_iter(vec![
            ("foo".to_string(), JsonValue::String("bar".to_string())),
            ("baz".to_string(), JsonValue::String("quux".to_string())),
            ("shell".to_string(), JsonValue::String("zsh".to_string())),
        ]);

        let rb = Runbook {
            version: 0,
            id: Uuid::from_str("019304aa-acee-7692-a615-3910acd948f3").unwrap(),
            name: Some("Test runbook".to_string()),
            content: vec![
                RunbookNode::heading("Hello world".to_string(), 1),
                RunbookNode::paragraph(vec![Content::text("".to_string(), vec![])]),
                RunbookNode::paragraph(vec![Content::text(
                    "This is a markdown doc".to_string(),
                    vec![],
                )]),
                RunbookNode::paragraph(vec![Content::text("".to_string(), vec![])]),
                RunbookNode::block(
                    "@core/terminal".to_string(),
                    terminal_props,
                    "echo 'foo'\necho 'bar'\nsudo apt update".to_string(),
                ),
            ],
            created: Some(time::OffsetDateTime::now_utc().unix_timestamp_nanos() as u64),
            updated: None,
        };

        let snapshot = r#"---
version: 0
id: 019304aa-acee-7692-a615-3910acd948f3
name: Test runbook
---
# Hello world

This is a markdown doc

```@core/terminal
---
baz: quux
foo: bar
shell: zsh
---
echo 'foo'
echo 'bar'
sudo apt update
```

Built with [Atuin Runbooks](https://atuin.sh)"#;
        let md = dump_markdown(&rb).unwrap();

        assert_eq!(snapshot.to_string(), md);
    }

    #[test]
    fn cyclic_parse_dump_test() {
        // Markdown doesn't handle whitespace in the AST, it is structural and not content
        // Therefore, atm, we don't handle whitespace 100% correctly
        let markdown = r#"---
version: 0
id: 019304aa-acee-7692-a615-3910acd948f3
name: Test runbook
---
# Hello world
This is a markdown doc
```@core/terminal
---
shell: zsh
---
echo 'foo'
echo 'bar'
sudo apt update
```"#;

        let rb = parse_markdown(markdown.to_string()).unwrap();
        let dumped = dump_markdown(&rb).unwrap();

        assert_eq!(
            format!(
                "{}\n\nBuilt with [Atuin Runbooks](https://atuin.sh)",
                markdown
            ),
            dumped
        );
    }

    #[test]
    fn markdown_links() {
        let rb = r#"[
            {"id":"f6596d68-4414-48f3-b502-eb54c9a00b17","type":"heading","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","level":1},"content":[{"type":"text","text":"md test","styles":{}}],"children":[]},
            {"id":"40599e96-0a29-490b-9e74-5502200de106","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"link","href":"https://atuin.sh","content":[{"type":"text","text":"Foo","styles":{}}]}],"children":[]},
            {"id":"3b1bda68-f2f5-4539-8527-2da5fd932177","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]},
            {"id":"1a90000b-8162-4f53-a00f-fed59dd7bf1b","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"foo ","styles":{}},{"type":"link","href":"https://atuin.sh","content":[{"type":"text","text":"bar","styles":{}}]},{"type":"text","text":" baz","styles":{}}],"children":[]},
            {"id":"30bd3f34-0288-43fe-9045-c58b71305e9d","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]}
        ]"#;
        let mut rb = Runbook::from_content(rb.to_string()).unwrap();
        rb.id = Uuid::from_str("01931812-3391-7580-bd68-4c98718841ff").unwrap();
        println!("{rb:?}");
        let md = dump_markdown(&rb).unwrap();

        let snapshot = r#"---
version: 0
id: 01931812-3391-7580-bd68-4c98718841ff
---
# md test
[Foo](https://atuin.sh)

foo [bar](https://atuin.sh) baz


Built with [Atuin Runbooks](https://atuin.sh)"#;

        assert_eq!(snapshot, md);
    }
}
