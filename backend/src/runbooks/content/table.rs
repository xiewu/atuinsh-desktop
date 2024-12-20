use super::Content;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TableRow {
    pub cells: Vec<Vec<Content>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Table {
    #[serde(rename = "columnWidths")]
    pub column_widths: Vec<Option<f64>>,

    pub rows: Vec<TableRow>,

    #[serde(default)]
    pub content: Vec<Content>,
}
