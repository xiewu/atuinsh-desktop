use std::{
    io::{BufRead, BufReader},
    process::{Command, Stdio},
};
use tauri::Emitter;

/// Execute a shell command and stream the output over a channel
/// Unlike a pty, this is not interactive
#[tauri::command]
pub async fn shell_exec(
    app: tauri::AppHandle,
    channel: String,
    command: String,
) -> Result<(), String> {
    // TODO: support other shells
    let mut cmd = Command::new("zsh")
        .arg("-c")
        .arg(command)
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();

    {
        let stdout = cmd.stdout.as_mut().unwrap();
        let stdout_reader = BufReader::new(stdout);
        let stdout_lines = stdout_reader.lines();

        for line in stdout_lines {
            app.emit(channel.as_str(), line.unwrap()).unwrap();
        }
    }

    cmd.wait().unwrap();

    Ok(())
}
