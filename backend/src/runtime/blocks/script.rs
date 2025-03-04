use serde::{Deserialize, Serialize};
use typed_builder::TypedBuilder;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, TypedBuilder)]
#[serde(rename_all = "camelCase")]
pub struct Script {
    #[builder(setter(into))]
    pub id: Uuid,

    #[builder(setter(into))]
    pub name: String,

    #[builder(setter(into))]
    pub code: String,

    #[builder(setter(into))]
    pub interpreter: String,

    #[builder(setter(into))]
    pub output_variable: Option<String>,

    #[builder(default = true)]
    pub output_visible: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, TypedBuilder)]
#[serde(rename_all = "camelCase")]
pub struct ScriptOutput {
    pub exit_code: i32,
}
