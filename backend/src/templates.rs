use minijinja::Environment;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::state::AtuinState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PtyTemplateState {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunbookTemplateState {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtuinTemplateState {
    pub pty: PtyTemplateState,
    pub runbook: RunbookTemplateState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockState {
    /// Name it something that's not just type lol
    pub block_type: String,
    pub content: String,
    pub props: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentTemplateState {
    pub first: BlockState,
    pub last: BlockState,
    pub content: Vec<BlockState>,

    /// The block previous to the current block
    /// This is, of course, contextual to what is presently executing - and
    /// only really makes sense if we're running a template from a Pty.
    /// We can use the pty map to lookup the metadata for the pty, and from there figure
    /// out the block ID
    pub previous: BlockState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateState {
    pub atuin: AtuinTemplateState,

    // In the case where a document is empty, we have no document state.
    pub doc: Option<DocumentTemplateState>,
}

fn serialized_block_to_state(block: serde_json::Value) -> BlockState {
    let block = block.as_object().unwrap();
    let block_type = block.get("type").unwrap().as_str().unwrap();

    // Content is tricky. It's actually an array, that might look something like this
    // ```
    // [
    //  {"styles":{},"text":"BIG ","type":"text"},
    //  {"styles":{"textColor":"blue"},"text":"BLOCK","type":"text"},
    //  {"styles":{},"text":" OF TEXT","type":"text"}
    // ]
    // ```
    // It might be fun to someday turn that into some ascii-coloured text in the terminal,
    // but for now we should just flatten it into a single string

    // 1. Get the content
    let content = block.get("content");

    // 2. Flatten into a single string. Ensure the type of each element is "text", ignore what
    //    isn't for now. If it's none, we can just ignore it
    let content = if let Some(content) = content {
        // Ensure it actually is an array
        match content {
            serde_json::Value::String(val) => val.clone(),
            serde_json::Value::Number(val) => val.to_string(),

            serde_json::Value::Array(val) => {
                let content = val.iter().filter_map(|v| {
                    let v = v.as_object()?;
                    if v.get("type")?.as_str()? == "text" {
                        Some(v.get("text")?.as_str()?.to_string())
                    } else {
                        None
                    }
                });
                content.collect::<Vec<String>>().join("")
            }

            _ => String::from(""),
        }
    } else {
        String::from("")
    };

    let props: HashMap<String, String> = block
        .get("props")
        .unwrap()
        .as_object()
        .unwrap()
        .iter()
        .map(|(k, v)| (k.clone(), v.as_str().unwrap_or_default().to_string()))
        .collect();

    // Now for some block-specific stuff

    // 1. For the editor block, the "code" prop contains the contents of the editor. It would be
    //    better if the template system exposed that as "content", even though it isn't stored like
    //    that in the internal schema
    let content: String = match block_type {
        "editor" => props
            .get("code")
            .map(String::clone)
            .unwrap_or(String::from("")),

        "run" => props
            .get("code")
            .map(String::clone)
            .unwrap_or(String::from("")),
        _ => content,
    };

    BlockState {
        block_type: block_type.to_string(),
        props,
        content: content.to_string(),
    }
}

#[tauri::command]
pub async fn template_str(
    source: String,
    runbook: Option<String>,
    pid: Option<uuid::Uuid>,
    state: tauri::State<'_, AtuinState>,
    doc: Vec<serde_json::Value>,
) -> Result<String, String> {
    let mut env = Environment::new();
    env.set_trim_blocks(true);

    if runbook.is_none() && pid.is_none() {
        return Err(String::from("template_str must have one of runbook or pid"));
    }

    let runbook = match runbook {
        Some(rb) => rb,

        None => {
            // At this point we know that PID is not None
            let pid = pid.unwrap();
            let sessions = state.pty_sessions.read().await;
            let pty = sessions.get(&pid).ok_or("Pty not found")?;

            pty.metadata.runbook.clone()
        }
    };

    let previous = if let Some(pid) = pid {
        let pty_store = state.pty_sessions.read().await;
        let pty = pty_store.get(&pid).unwrap();
        let block_id = pty.metadata.block.clone();

        // Iterate through the doc, and find the block previous to the current one
        // If the previous block is an empty paragraph, skip it. Its content array will have 0
        // length
        let previous = doc.iter().enumerate().find_map(|(i, block)| {
            let block = block.as_object().unwrap();
            if block.get("id").unwrap().as_str().unwrap() == block_id {
                if i == 0 {
                    None
                } else {
                    // Continue iterating backwards until we find a block that isn't an empty
                    // paragraph
                    let mut i = i - 1;
                    loop {
                        let block = doc.get(i).unwrap().as_object().unwrap();
                        if block.get("type").unwrap().as_str().unwrap() == "paragraph"
                            && block.get("content").unwrap().as_array().unwrap().len() == 0
                        {
                            if i == 0 {
                                return None;
                            } else {
                                i -= 1;
                            }
                        } else {
                            return Some(doc.get(i).unwrap().clone());
                        }
                    }
                }
            } else {
                None
            }
        });

        previous
    } else {
        None
    };

    let previous = previous.unwrap_or_default();

    let doc_state = if !doc.is_empty() {
        Some(DocumentTemplateState {
            previous: serialized_block_to_state(previous),
            first: serialized_block_to_state(doc.first().unwrap().clone()),
            last: serialized_block_to_state(doc.last().unwrap().clone()),
            content: doc.into_iter().map(serialized_block_to_state).collect(),
        })
    } else {
        None
    };

    let source = env
        .render_str(
            source.as_str(),
            TemplateState {
                atuin: AtuinTemplateState {
                    pty: PtyTemplateState {
                        id: pid.map(|id| id.to_string()).unwrap_or_default(),
                    },
                    runbook: RunbookTemplateState { id: runbook },
                },
                doc: doc_state.clone(),
            },
        )
        .map_err(|e| e.to_string())?;

    println!("{doc_state:?}");

    Ok(source)
}
