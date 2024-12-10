// Represent a runbook as raw data

use eyre::Result;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::{
    content::RunbookContent,
    markdown::{self, parse_markdown},
};

pub const CURRENT_RUNBOOK_VERSION: u32 = 0;

/// Take a runbook from the frontend, and create an atmd markdown file
/// We pass the function a blob of JSON that represents the doc. Currently this comes from
/// Blocknote. This is then parsed into our Runbook, and returned as Markdown
///
/// If a filepath is provided, then the markdown will also be written to the file
#[tauri::command]
pub fn export_atmd(json: String, path: Option<String>) -> Result<String, String> {
    let runbook = Runbook::from_content(json).map_err(|e| e.to_string())?;
    let markdown = runbook.to_markdown().map_err(|e| e.to_string())?;

    if let Some(path) = path {
        std::fs::write(path, markdown.as_bytes()).map_err(|e| e.to_string())?;
    }

    Ok(markdown)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Runbook {
    pub version: u32,
    pub id: Uuid,
    pub content: RunbookContent,

    // If we're parsing a runbook from a markdown file, it might not have all of this metadata.
    // When exporting, we should try and ensure there's the correct front matter. But this doesn't
    // necessarily exist in all cases.
    // Users should actually be able to import a plain old markdown file and get _something_ useful
    pub name: Option<String>,
    pub created: Option<u64>,
    pub updated: Option<u64>,
}

impl Runbook {
    /// Take pure runbook content, and parse into a struct. We will infer as much information as
    /// possible
    pub fn from_content(content: String) -> Result<Runbook> {
        let content: RunbookContent = serde_json::from_str(content.as_str())?;
        let created = time::OffsetDateTime::now_utc().unix_timestamp_nanos();

        let runbook = Runbook {
            version: CURRENT_RUNBOOK_VERSION,
            id: Uuid::now_v7(),
            content,

            name: None,
            created: Some(created as u64),
            updated: None,
        };

        Ok(runbook)
    }

    /// Take a markdown runbook and parse it
    /// Note that this uses our markdown superset, with frontmatter style blocks within code blocks
    #[allow(dead_code)]
    pub fn from_markdown(markdown: String) -> Result<Runbook> {
        parse_markdown(markdown)
    }

    pub fn to_markdown(&self) -> Result<String> {
        markdown::dump_markdown(self)
    }
}

#[cfg(test)]
mod tests {
    use std::str::FromStr;

    use uuid::Uuid;

    use crate::runbooks::runbook::CURRENT_RUNBOOK_VERSION;
    use serde_json::value::Value as JsonValue;
    use serde_json::Number;

    use super::Runbook;

    #[test]
    fn parse_empty_runbook_content() {
        // Given a pretty empty runbook, can we parse it?
        let content = r#"[
            {
                "id":"084e2855-da64-42f5-96e1-a6e9700c91ac",
                "type":"heading",
                "props": {
                    "textColor":"default",
                    "backgroundColor": "default",
                    "textAlignment":"left",
                    "level":1
                },
                "content":[
                    {
                        "type":"text",
                        "text":"Local dev",
                        "styles":{}
                    }
                ],
                "children":[]
            }
        ]"#;

        let runbook = Runbook::from_content(content.to_string()).unwrap();

        assert_eq!(runbook.version, CURRENT_RUNBOOK_VERSION);
        assert_eq!(runbook.content.len(), 1);

        assert_eq!(runbook.content[0].type_, "heading");
        assert_eq!(
            runbook.content[0].id,
            Uuid::from_str("084e2855-da64-42f5-96e1-a6e9700c91ac").unwrap()
        );

        assert_eq!(runbook.content[0].props.len(), 4);
        assert_eq!(
            runbook.content[0].props.get("textColor"),
            Some(&JsonValue::String("default".to_string()))
        );
        assert_eq!(
            runbook.content[0].props.get("level"),
            Some(&JsonValue::Number(Number::from_u128(1).unwrap()))
        );
    }
}
