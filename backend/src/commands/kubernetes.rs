use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KubernetesGetExecuteRequest {
    pub command: String,
    pub interpreter: String,
    pub env: std::collections::HashMap<String, String>,
    pub cwd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KubernetesGetExecuteResponse {
    pub output: String,
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn kubernetes_get_execute(
    request: KubernetesGetExecuteRequest,
) -> Result<KubernetesGetExecuteResponse, String> {
    use crate::run::shell;

    // Execute the kubectl command using the existing shell execution infrastructure
    match shell::shell_exec_sync(
        request.interpreter,
        request.command,
        Some(request.env),
        Some(request.cwd),
    )
    .await
    {
        Ok(output) => Ok(KubernetesGetExecuteResponse {
            output,
            success: true,
            error: None,
        }),
        Err(e) => Ok(KubernetesGetExecuteResponse {
            output: String::new(),
            success: false,
            error: Some(e.to_string()),
        }),
    }
}
