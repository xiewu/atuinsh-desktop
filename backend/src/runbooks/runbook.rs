// Represent a runbook as raw data

use eyre::Result;
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

use crate::{run::pty::remove_pty, state::AtuinState};

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

/// Export a runbook. Pass in the content, and the location to save the file
/// Why do this in Rust?
///
/// 1. Tauri has a bunch of filesystem limitations to not allow blanket writes to JS.
/// This totally makes sense, but for this specific case we should bypass that for writing Runbook content.
/// We also allow generic shell command execution in our frontend, so this isn't a big deal
///
/// 2. While we're not doing a tonne of validation right now, I'd like to ensure that this can be properly parsed into
/// our Runbook struct before we save it to disk.
#[tauri::command]
pub fn export_atrb(json: String, file_path: String) -> Result<(), String> {
    let runbook = Runbook::from_json(json).map_err(|e| e.to_string())?;
    let json = serde_json::to_string(&runbook).map_err(|e| e.to_string())?;

    std::fs::write(file_path, json.as_bytes()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_runbook_cleanup(
    app: tauri::AppHandle,
    state: State<'_, AtuinState>,
    runbook: String,
) -> Result<(), String> {
    // Cleanup all PTYs first
    // Seeing as we do not (yet) store runbook data grouped by runbook, we have to
    // iterate all of them and check the metadata. Boo.

    let ptys_to_remove: Vec<_> = {
        let ptys = state.pty_sessions.read().await;
        ptys.iter()
            .filter(|(_, pty)| pty.metadata.runbook == runbook)
            .map(|(pty_id, _)| *pty_id)
            .collect()
    };

    for pty_id in ptys_to_remove {
        remove_pty(app.clone(), pty_id, state.pty_sessions.clone()).await?;
    }

    Ok(())
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

    pub fn from_json(json: String) -> Result<Runbook> {
        let runbook: Runbook = serde_json::from_str(json.as_str())?;
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

    #[test]
    fn parse_complex_runbook_content() {
        let content = r#"
            [{"id":"f6596d68-4414-48f3-b502-eb54c9a00b17","type":"heading","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","level":1},"content":[{"type":"text","text":"Heading 1","styles":{}}],"children":[]},{"id":"e6cba3ec-f0a9-47a9-950b-a9e93d25d2b6","type":"heading","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","level":2},"content":[{"type":"text","text":"Heading 2","styles":{}}],"children":[]},{"id":"20fc952c-9b66-40c1-b982-04a052f4bee9","type":"heading","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","level":3},"content":[{"type":"text","text":"Heading 3","styles":{}}],"children":[]},{"id":"a3f0e2c9-be18-40bc-8d29-8e26b14c2f7c","type":"numberedListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Numbered","styles":{}}],"children":[{"id":"4fd5efc1-f05e-4e70-8ee6-9c75aa218281","type":"numberedListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Nested","styles":{}}],"children":[]},{"id":"5de76cc5-aeb9-44ec-b3b5-b4664fbc70fe","type":"numberedListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"List","styles":{}}],"children":[]}]},{"id":"1beeaf75-979c-4318-9a0f-0a9699d9a609","type":"numberedListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"List","styles":{}}],"children":[]},{"id":"75fb0503-53d7-4334-bdc6-8792e508cbd0","type":"bulletListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Bullet","styles":{}}],"children":[{"id":"78834d39-54c3-4c68-96f3-96c8dfe496d3","type":"bulletListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Nested","styles":{}}],"children":[]},{"id":"dbfd1a7e-3c0a-45ba-bfb7-24d46b24c018","type":"bulletListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"List","styles":{}}],"children":[]}]},{"id":"06a0afed-28f3-4824-8667-9d7bdcd52bc7","type":"bulletListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"List","styles":{}}],"children":[]},{"id":"d2c4803f-52fd-4110-a843-90cb2364a122","type":"checkListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","checked":false},"content":[{"type":"text","text":"Check","styles":{}}],"children":[{"id":"ac15df04-442f-4916-ba3f-d1d79967d797","type":"checkListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","checked":false},"content":[{"type":"text","text":"Nested","styles":{}}],"children":[]},{"id":"2986729c-2a30-4b6d-b323-e5abf239df12","type":"checkListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","checked":false},"content":[{"type":"text","text":"List","styles":{}}],"children":[]},{"id":"1afc9c23-4c5d-4f7a-874c-ae31d6ce2a5a","type":"checkListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","checked":true},"content":[{"type":"text","text":"Checked","styles":{}}],"children":[]}]},{"id":"f5cdf112-be05-46c0-949b-371595bc25ae","type":"checkListItem","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left","checked":true},"content":[{"type":"text","text":"List","styles":{}}],"children":[]},{"id":"5091f896-7b1d-490c-8513-00448116746d","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"Paragraph","styles":{}}],"children":[]},{"id":"3862b1bb-b463-4959-b805-85e4437842c2","type":"table","props":{"textColor":"default"},"content":[{"type":"tableContent","columnWidths":[null,null,null],"rows":[{"cells":[[{"type":"text","text":"Table","styles":{}}],[{"type":"text","text":"With","styles":{}}],[{"type":"text","text":"Some","styles":{}}]]},{"cells":[[{"type":"text","text":"Data","styles":{}}],[{"type":"text","text":"Goes","styles":{}}],[{"type":"text","text":"Here","styles":{}}]]}]}],"children":[]},{"id":"6bbd8321-133e-4708-acb2-937a31411e80","type":"image","props":{"backgroundColor":"default","textAlignment":"left","name":"atuin_logo.png","url":"https://hub.atuin.sh/images/atuin_logo.png","caption":"","showPreview":true,"previewWidth":512},"children":[]},{"id":"c5369d43-9afa-41a0-bdf6-cf0f60dd3287","type":"video","props":{"backgroundColor":"default","textAlignment":"center","name":"12254921_2560_1440_24fps.mp4","url":"https://videos.pexels.com/video-files/27893927/12254921_2560_1440_24fps.mp4","caption":"","showPreview":true,"previewWidth":748},"children":[]},{"id":"9bb3af22-608b-403e-ad8a-a8083bc9b163","type":"audio","props":{"backgroundColor":"default","name":"Something%20in%20Your%20Eyes%2079bpm.mp3","url":"http://michelletilley.net/misc/music/Something%20in%20Your%20Eyes%2079bpm.mp3","caption":"","showPreview":true},"children":[]},{"id":"f628999e-65d6-433e-befd-910b739e54b2","type":"file","props":{"backgroundColor":"default","name":"dummy.pdf","url":"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf","caption":""},"children":[]},{"id":"9a2d7f64-bc1d-4741-a144-f6cc2c454c3c","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[{"type":"text","text":"🔢 ","styles":{}}],"children":[]},{"id":"b339887e-746a-4d2c-b344-cee575cda742","type":"@core/terminal","props":{"body":"Here\nis\na\nscript"},"children":[]},{"id":"77dd473a-aa1a-46ae-82bf-406c3763ac89","type":"@core/directory","props":{"body":"cd ~/Documents/"},"children":[]},{"id":"22ea31c9-3adb-4042-bb51-b88e881d0c15","type":"@core/env","props":{"body":"PHX_SERVER=true"},"children":[]},{"id":"63302eb4-4b11-4a64-94b9-0308b4fdbab3","type":"@core/sqlite","props":{"uri":"","autoRefresh":0,"body":"select * from users;"},"children":[]},{"id":"26ae2339-2d14-460f-a04a-59997ad5beb5","type":"@core/postgres","props":{"uri":"","autoRefresh":0,"body":"select * from users;"},"children":[]},{"id":"4c97d852-f118-428e-9458-accaabd5d4da","type":"@core/clickhouse","props":{"uri":"","autoRefresh":0,"body":"do things with stuff"},"children":[]},{"id":"e6e87318-8160-4b11-be0b-b70c6c9713aa","type":"@core/http","props":{"url":"","verb":"GET","body":"","headers":"{\"authorization\":\"Bearer something something\"}"},"children":[]},{"id":"aa7c9bcf-f874-4834-ab82-3697f3644485","type":"@core/editor","props":{"language":"html","body":"    <div class=\"uk-container uk-container-small mx-auto\">\n      <h2 class=\"uk-h3 md:uk-h2\">\n        <.link navigate={\"/#{@user.username}\"} class=\"uk-link\"><%= @user.username %></.link>\n        / <%= @runbook.slug %>\n      </h2>\n      <p class=\" mb-4 uk-text-muted uk-text-small\"><%= @runbook.client_id %></p>\n\n      <div class=\"hidden md:flex justify-end mb-4\">\n        <a\n          href={\"atuin://runbook/#{@user.username}/#{@runbook.client_id}\"}\n          class=\"uk-button uk-button-default\"\n        >\n          Open in Desktop\n        </a>\n      </div>\n\n      <.runbook runbook={@runbook} />\n    </div>\n"},"children":[]},{"id":"a47b8548-7f35-4979-8aa5-ea38462036f9","type":"paragraph","props":{"textColor":"default","backgroundColor":"default","textAlignment":"left"},"content":[],"children":[]}]
            "#;
        let _runbook = Runbook::from_content(content.to_string()).unwrap();
    }
}
