use eyre::{eyre, Result};
use serde_json::Value as JsonValue;
use sqlx::{mysql::MySqlValueRef, TypeInfo, Value, ValueRef};
use time::{Date, OffsetDateTime, PrimitiveDateTime, Time};

pub(crate) fn to_json(v: MySqlValueRef) -> Result<JsonValue> {
    if v.is_null() {
        return Ok(JsonValue::Null);
    }

    let res = match v.type_info().name() {
        "VARCHAR" | "CHAR" | "TEXT" | "TINYTEXT" | "MEDIUMTEXT" | "LONGTEXT" => {
            if let Ok(v) = ValueRef::to_owned(&v).try_decode() {
                JsonValue::String(v)
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
            if let Ok(v) = ValueRef::to_owned(&v).try_decode() {
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
        "BLOB" | "TINYBLOB" | "MEDIUMBLOB" | "LONGBLOB" | "BINARY" | "VARBINARY" => {
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
