use serde_json::{Map, Value};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum FrontMatterError {
    #[allow(dead_code)]
    #[error("missing yaml section")]
    MissingYaml,

    #[error("yaml parse error: {0}")]
    YamlError(#[from] serde_yaml::Error),
}

#[derive(Debug)]
pub struct ParsedContent {
    pub metadata: Map<String, Value>,
    pub content: String,
}

pub fn parse_front_matter(content: &str) -> Result<ParsedContent, FrontMatterError> {
    let lines: Vec<&str> = content.lines().collect();

    // If doesn't start with ---, no front matter
    if !lines.starts_with(&["---"]) {
        return Ok(ParsedContent {
            metadata: serde_json::Map::new(),
            content: content.to_string(),
        });
    }

    // Find end of YAML section
    let yaml_end = lines[1..]
        .iter()
        .position(|line| *line == "---")
        .ok_or(FrontMatterError::MissingYaml)?
        + 1;

    // Parse YAML to serde_json::Value
    let yaml_str = lines[1..yaml_end].join("\n");
    let metadata: Map<String, Value> = serde_yaml::from_str(&yaml_str)?;

    // Get the content after the front matter
    let content = lines[yaml_end + 1..].join("\n");

    Ok(ParsedContent { metadata, content })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_with_front_matter() {
        let input = r#"---
name: setup-rust
depends-on: 
  - other-block
---
curl https://sh.rustup.rs | sh"#;

        let parsed = parse_front_matter(input).unwrap();
        assert!(parsed.metadata.contains_key("name"));
        assert_eq!(parsed.content, "curl https://sh.rustup.rs | sh");
    }

    #[test]
    fn test_without_front_matter() {
        let input = "echo 'Hello World'";

        let parsed = parse_front_matter(input).unwrap();
        assert!(parsed.metadata.is_empty());
        assert_eq!(parsed.content, "echo 'Hello World'");
    }

    #[test]
    fn test_complex_yaml() {
        let input = r#"---
verb: post
url: https://api.example.com
headers:
  Content-Type: application/json
  Authorization: Bearer token
params:
  foo: bar
  baz: 42
---
{"data": "content"}"#;

        let parsed = parse_front_matter(input).unwrap();
        let metadata = parsed.metadata;
        assert_eq!(metadata["verb"], "post");
        assert!(metadata["headers"].is_object());
        assert_eq!(parsed.content, "{\"data\": \"content\"}");
    }
}
