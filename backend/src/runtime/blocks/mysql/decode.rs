use eyre::{eyre, Result};
use serde_json::Value as JsonValue;
use sqlx::{mysql::MySqlValueRef, TypeInfo, Value, ValueRef};
use time::{Date, OffsetDateTime, PrimitiveDateTime, Time};

// TODO(ellie): fix this one lol
// ref: https://github.com/launchbadge/sqlx/issues/3387
fn is_likely_text(bytes: &[u8]) -> bool {
    if bytes.is_empty() {
        return true;
    }

    let printable_count = bytes
        .iter()
        .filter(|&&b| {
            (32..=126).contains(&b) || (160..=255).contains(&b) || b == 9 || b == 10 || b == 13
        })
        .count();

    (printable_count as f32 / bytes.len() as f32) > 0.9
}

pub(crate) fn to_json(v: MySqlValueRef) -> Result<JsonValue> {
    if v.is_null() {
        return Ok(JsonValue::Null);
    }

    let res = match v.type_info().name() {
        "VARCHAR" | "CHAR" | "TEXT" | "TINYTEXT" | "MEDIUMTEXT" | "LONGTEXT" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<String>() {
                JsonValue::String(v)
            } else {
                JsonValue::Null
            }
        }
        // Handle the SQLx bug where VARCHAR with binary collation shows as VARBINARY
        "VARBINARY" | "BINARY" => {
            if let Ok(bytes) = ValueRef::to_owned(&v).try_decode::<Vec<u8>>() {
                // Try to detect if it's actually text
                if is_likely_text(&bytes) {
                    // Convert as latin1
                    let text: String = bytes.iter().map(|&b| b as char).collect();
                    JsonValue::String(text)
                } else {
                    // Actually binary data
                    JsonValue::Array(
                        bytes
                            .into_iter()
                            .map(|n| JsonValue::Number(n.into()))
                            .collect(),
                    )
                }
            } else {
                JsonValue::Null
            }
        }
        "FLOAT" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<f32>() {
                JsonValue::from(v)
            } else {
                JsonValue::Null
            }
        }
        "DOUBLE" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<f64>() {
                JsonValue::from(v)
            } else {
                JsonValue::Null
            }
        }
        "TINYINT" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<i8>() {
                JsonValue::Number(v.into())
            } else {
                JsonValue::Null
            }
        }
        "SMALLINT" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<i16>() {
                JsonValue::Number(v.into())
            } else {
                JsonValue::Null
            }
        }
        "INT" | "MEDIUMINT" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<i32>() {
                JsonValue::Number(v.into())
            } else {
                JsonValue::Null
            }
        }
        "BIGINT" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<i64>() {
                JsonValue::Number(v.into())
            } else {
                JsonValue::Null
            }
        }
        "BOOLEAN" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<bool>() {
                JsonValue::Bool(v)
            } else {
                JsonValue::Null
            }
        }
        "DATE" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<Date>() {
                JsonValue::String(v.to_string())
            } else {
                JsonValue::Null
            }
        }
        "TIME" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<Time>() {
                JsonValue::String(v.to_string())
            } else {
                JsonValue::Null
            }
        }
        "DATETIME" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<PrimitiveDateTime>() {
                JsonValue::String(v.to_string())
            } else {
                JsonValue::Null
            }
        }
        "TIMESTAMP" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<OffsetDateTime>() {
                JsonValue::String(v.to_string())
            } else {
                JsonValue::Null
            }
        }
        "JSON" => ValueRef::to_owned(&v).try_decode().unwrap_or_default(),
        "BLOB" | "TINYBLOB" | "MEDIUMBLOB" | "LONGBLOB" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<Vec<u8>>() {
                JsonValue::Array(v.into_iter().map(|n| JsonValue::Number(n.into())).collect())
            } else {
                JsonValue::Null
            }
        }
        "DECIMAL" | "NUMERIC" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode::<bigdecimal::BigDecimal>() {
                JsonValue::from(v.to_string())
            } else {
                JsonValue::Null
            }
        }
        _ => {
            return Err(eyre!(
                "Unsupported data type: {}",
                v.type_info().name().to_string()
            ))
        }
    };

    Ok(res)
}
