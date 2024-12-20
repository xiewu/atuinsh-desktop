use std::collections::HashMap;

// Super small file, but let's break out each
// content node! Encourage helper functions cuz tbh these are no fun to work on
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Text {
    pub text: String,

    #[serde(default)]
    pub styles: HashMap<String, String>,
}
