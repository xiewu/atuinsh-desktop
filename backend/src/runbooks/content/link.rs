// Super small file, but let's break out each
// content node! Encourage helper functions cuz tbh these are no fun to work on
use super::Content;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Link {
    pub href: String,

    #[serde(default)]
    pub content: Vec<Content>,
}
