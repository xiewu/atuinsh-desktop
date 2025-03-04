use serde::{Deserialize, Serialize};
use typed_builder::TypedBuilder;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, TypedBuilder)]
#[serde(rename_all = "camelCase")]
pub struct Prometheus {
    #[builder(setter(into))]
    pub id: Uuid,

    #[builder(setter(into))]
    pub name: String,

    #[builder(setter(into))]
    pub query: String,

    #[builder(setter(into))]
    pub endpoint: String,

    #[builder(setter(into))]
    pub period: String,

    #[builder(default = false)]
    pub auto_refresh: bool,
}
