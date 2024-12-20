use std::collections::HashMap;
use typed_builder::TypedBuilder;

use serde::{Deserialize, Serialize};
use serde_json::{value::Value as JsonValue, Map, Number};
use uuid::Uuid;

pub type RunbookContent = Vec<RunbookNode>;

pub mod link;
pub mod table;
pub mod text;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Content {
    Text(text::Text),

    Link(link::Link),

    #[allow(clippy::enum_variant_names)]
    TableContent(table::Table),
}

/// We should probably implement serde's Serialize trait, but I'm afraid I'm quite lazy and that
/// looks gross to do.
impl Content {
    pub fn text(text: String) -> Content {
        Content::Text(text::Text {
            text,
            styles: HashMap::new(),
        })
    }

    pub fn link(href: String, content: Vec<Content>) -> Content {
        Content::Link(link::Link { href, content })
    }
}

#[derive(Serialize, Deserialize)]
pub struct RunbookFrontMatter {
    pub version: u32,
    pub id: Uuid,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub authors: Option<Vec<String>>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, TypedBuilder, Clone, Debug)]
pub struct RunbookNode {
    #[builder(default=Uuid::now_v7())]
    pub id: Uuid,

    #[builder(default)]
    pub name: Option<String>,

    #[serde(rename = "type")]
    pub type_: String,

    #[builder(default)]
    pub props: serde_json::value::Map<String, JsonValue>,

    #[builder(default)]
    #[serde(default)]
    pub content: Vec<Content>,

    #[builder(default)]
    #[serde(default)]
    pub children: Vec<RunbookNode>,
}

impl RunbookNode {
    pub fn heading(value: String, level: u16) -> RunbookNode {
        let props = Map::from_iter(vec![
            (
                "textColor".to_string(),
                JsonValue::String("default".to_string()),
            ),
            (
                "backgroundColor".to_string(),
                JsonValue::String("default".to_string()),
            ),
            (
                "textAlignment".to_string(),
                JsonValue::String("left".to_string()),
            ),
            (
                "level".to_string(),
                JsonValue::Number(Number::from_u128(level as u128).unwrap()),
            ),
        ]);

        RunbookNode::builder()
            .type_("heading".to_string())
            .props(props)
            .content(vec![Content::text(value)])
            .build()
    }

    pub fn paragraph(content: Vec<Content>) -> RunbookNode {
        let props = Map::from_iter(vec![
            (
                "textColor".to_string(),
                JsonValue::String("default".to_string()),
            ),
            (
                "backgroundColor".to_string(),
                JsonValue::String("default".to_string()),
            ),
            (
                "textAlignment".to_string(),
                JsonValue::String("left".to_string()),
            ),
        ]);

        RunbookNode::builder()
            .type_("paragraph".to_string())
            .props(props)
            .content(content)
            .build()
    }

    /// Create a new block
    /// This is an embedded executable block - bash, postgres, etc
    pub fn block(
        type_: String,
        front_matter: Map<String, JsonValue>,
        contents: String,
    ) -> RunbookNode {
        RunbookNode::builder()
            .type_(type_)
            .props(front_matter)
            .content(vec![Content::text(contents)])
            .build()
    }

    // If we have a body prop, return it
    pub fn body_content(&self) -> Option<String> {
        // check if we have a body prop in props
        if let Some(body) = self.props.get("body") {
            return Some(body.as_str().unwrap().to_string());
        }

        None
    }

    pub fn text_content(&self) -> String {
        self.content
            .iter()
            .map(|c| match c {
                Content::Text(super::content::text::Text { text, .. }) => text.clone(),

                Content::Link(super::content::link::Link { content, .. }) => {
                    match content.as_slice() {
                        [Content::Text (super::content::text::Text{ text, .. })] => text.clone(),

                        _ => "".to_string(),
                    }
                }

                _ => unimplemented!("todo, promise. I really want to get it merged and running soon so it doesn't languish forever"),
            })
            .collect()
    }
}
