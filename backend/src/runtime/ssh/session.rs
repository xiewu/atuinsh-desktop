// Handle making SSH connections. Do not manage or pool them, just handle the actual plumbing.
// This is essentially a wrapper around the ssh2 crate.

use bytes::Bytes;
use std::path::Path;
use std::path::PathBuf;
use tokio::sync::mpsc;
use tokio::sync::{mpsc::Sender, oneshot};

use tokio::net::TcpStream;

use async_ssh2_lite::AsyncSession;
use eyre::Result;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::runtime::ssh_pool::SshPoolHandle;

/// An ssh session, wrapping the underlying ssh2 with async-safe primitives
/// Safe to clone across threads - the session is managed behind a mutex (within ssh2)
#[derive(Clone)]
pub struct Session {
    session: AsyncSession<async_ssh2_lite::TokioTcpStream>,
}

/// Authentication methods
pub enum Authentication {
    Key(String, PathBuf),
    Password(String, String),
}

impl Session {
    /// Open a new SSH session to the given host, and handshake. Do not authenticate.
    pub async fn open(host: &str) -> Result<Self> {
        let tcp = TcpStream::connect(host).await?;
        let mut sess = AsyncSession::new(tcp, None)?;

        sess.handshake().await?;

        // only applies for read/write operations to channels
        // Without this, if we are blocking on a read to channel A, reads to channel B will block indefinitely.
        // no bueno when we're going to want to be multiplexing a bunch of shit all over the place

        Ok(Session { session: sess })
    }

    /// Password authentication with timeout
    async fn password_auth(&self, username: &str, password: &str) -> Result<()> {
        self.session.userauth_password(username, password).await?;

        Ok(())
    }

    /// Public key authentication with timeout
    async fn key_auth(&self, username: &str, _user: &str, key_path: PathBuf) -> Result<()> {
        self.session
            .userauth_pubkey_file(username, None, &key_path, None)
            .await?;

        Ok(())
    }

    async fn agent_auth(&self, username: &str) -> Result<bool> {
        let mut agent = self.session.agent()?;
        agent.connect().await?;
        agent.list_identities().await?;

        let identities = agent.identities()?;

        for key in identities {
            let username = username.to_string();
            match agent.userauth(&username, &key).await {
                Ok(()) => {
                    log::debug!("Authenticated with host");
                }
                Err(e) => {
                    log::debug!("Failed to authenticate with host: {}", e);
                }
            }

            // the above should handle the case where the agent is authenticated, but I'd prefer we check explicitly
            if self.session.authenticated() {
                return Ok(true);
            }
        }

        Ok(false)
    }

    /// Authenticate the session. If a username is provided, use it for authentication - otherwise we will use "root"
    ///
    /// Regardless of the provided authentication method, this function will try the following in order
    ///
    /// 1. Noauth (99% of the time does nothing, but for cases like tailscale ssh this is required)
    /// 2. Agent - attempt to authenticate using the identities available to the agent
    /// 3. Provided authentication method, if provided
    pub async fn authenticate(
        &self,
        auth: Option<Authentication>,
        username: Option<&str>,
    ) -> Result<()> {
        let username = username.unwrap_or("root");
        log::debug!("SSH authentication as {}", username);

        // 1. ssh userauth none, potentially trigger tailscale ssh auth/etc
        // TODO(ellie): this is blocking!
        self.session.auth_methods(username).await?;

        if self.session.authenticated() {
            log::debug!("SSH authentication successful with no auth");
            return Ok(());
        }

        // 2. attempt ssh agent auth
        self.agent_auth(username).await?;

        if self.session.authenticated() {
            log::debug!("SSH authentication successful with agent");
            return Ok(());
        }

        // 3. whatever the user provided
        match auth {
            Some(Authentication::Password(_user, password)) => {
                self.password_auth(username, &password).await?
            }
            Some(Authentication::Key(user, key_path)) => {
                self.key_auth(username, &user, key_path).await?
            }
            None => {}
        }

        Ok(())
    }

    pub async fn disconnect(&self) -> Result<()> {
        // dropping the session object will close the underlying socket
        self.session.disconnect(None, "", None).await?;
        Ok(())
    }

    /// Open a new SSH channel and execute a command
    #[allow(clippy::too_many_arguments)]
    pub async fn exec(
        &self,
        handle: SshPoolHandle,
        channel_id: String,
        output_stream: Sender<String>,
        mut cancel_rx: oneshot::Receiver<()>,
        interpreter: &str,
        command: &str,
    ) -> Result<()> {
        // Much like we do with the shell command exec, lets spawn a task to read the output line-by-line,
        // and then write it to the app channel as we receive it
        let mut channel = self.session.channel_session().await?;

        // as a hack to workaround annoying interpreter things, we can first write the actual script as a file to the remote.
        // the path can be ~/.atuin/.ssh/{channel_id}
        // then we can call the interpreter on it
        // then, cleanup.
        let script_bin = command.as_bytes();

        channel
            .exec("mkdir -p ~/.atuin/ssh/script && echo -n $HOME")
            .await?;
        let mut home = String::new();
        channel.read_to_string(&mut home).await?;

        let path = Path::new(&home)
            .join(".atuin/ssh/script/")
            .join(channel_id.as_str());

        log::debug!("Sending script to remote path: {}", path.display());
        let mut remote_file = self
            .session
            .scp_send(path.as_path(), 0o700, script_bin.len() as u64, None)
            .await?;
        remote_file.write_all(script_bin).await?;
        remote_file.flush().await?;
        remote_file.send_eof().await?;
        remote_file.wait_eof().await?;
        remote_file.close().await?;
        remote_file.wait_close().await?;

        let mut channel = self.session.channel_session().await?;
        let mut cleanup_channel = self.session.channel_session().await?;
        let mut kill_channel = self.session.channel_session().await?;
        let command = format!("{} {}", interpreter, path.display());
        let kill_command = format!(
            "ps -ef | grep \"{}\" | grep -v grep | awk '{{print $2}}' | xargs kill -9",
            channel_id
        );

        log::debug!("Executing command on remote: {}", command);
        tokio::task::spawn(async move {
            if let Err(e) = channel.exec(&command).await {
                log::error!("Failed to execute command: {}", e);
                output_stream.send(e.to_string()).await.unwrap();
                return;
            }

            let mut buffer = [0; 1024];
            let mut stderr_buffer = [0; 1024];
            let mut line_buffer = String::new();
            let mut stderr_line_buffer = String::new();
            let mut stderr = channel.stderr();

            loop {
                tokio::select! {
                    // Check if we've been asked to cancel
                    _ = &mut cancel_rx => {
                        log::debug!("SSH command execution cancelled");
                        kill_channel.exec(&kill_command).await.unwrap();
                        break;
                    }
                    // Try to read from stdout
                    read_result = channel.read(&mut buffer) => {
                        match read_result {
                            Ok(n) if n > 0 => {
                                // Convert bytes to string and process line by line
                                if let Ok(data) = std::str::from_utf8(&buffer[..n]) {
                                    line_buffer.push_str(data);

                                    // Process complete lines
                                    while let Some(pos) = line_buffer.find('\n') {
                                        let line = line_buffer[..pos].to_string();
                                        line_buffer = line_buffer[pos + 1..].to_string();

                                        if output_stream.send(line).await.is_err() {
                                            // Receiver dropped, exit
                                            break;
                                        }
                                    }
                                }
                            }
                            Ok(_) => {
                                // End of stream, send any remaining data
                                if !line_buffer.is_empty() {
                                    let _ = output_stream.send(line_buffer).await;
                                }
                                break;
                            }
                            Err(e) => {
                                log::error!("Error reading SSH stdout: {}", e);
                                output_stream.send(format!("Error reading stdout: {}", e)).await.unwrap_or_default();
                                break;
                            }
                        }
                    }
                    // Try to read from stderr
                    stderr_result = stderr.read(&mut stderr_buffer) => {
                        match stderr_result {
                            Ok(n) if n > 0 => {
                                // Convert bytes to string and process line by line
                                if let Ok(data) = std::str::from_utf8(&stderr_buffer[..n]) {
                                    stderr_line_buffer.push_str(data);

                                    // Process complete lines
                                    while let Some(pos) = stderr_line_buffer.find('\n') {
                                        let line = stderr_line_buffer[..pos].to_string();
                                        stderr_line_buffer = stderr_line_buffer[pos + 1..].to_string();

                                        if output_stream.send(line).await.is_err() {
                                            // Receiver dropped, exit
                                            break;
                                        }
                                    }
                                }
                            }
                            Ok(_) => {
                                // End of stream, send any remaining data
                                if !stderr_line_buffer.is_empty() {
                                    let _ = output_stream.send(stderr_line_buffer.clone()).await;
                                }
                                // Don't break the main loop here, as stdout might still have data
                            }
                            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                                // No data available on stderr right now, that's fine
                                // Continue the loop
                            }
                            Err(e) => {
                                log::error!("Error reading SSH stderr: {}", e);
                                output_stream.send(format!("Error reading stderr: {}", e)).await.unwrap_or_default();
                                // Don't break the main loop here, as stdout might still have data
                            }
                        }
                    }
                }
            }

            log::debug!("Sending EOF and exec finished for channel {}", channel_id);
            channel.send_eof().await.unwrap();
            channel.shutdown().await.unwrap();
            channel.close().await.unwrap();
            drop(channel);

            cleanup_channel
                .exec(&format!("rm -f {}", path.display()))
                .await
                .unwrap();
            cleanup_channel.send_eof().await.unwrap();
            cleanup_channel.shutdown().await.unwrap();
            cleanup_channel.close().await.unwrap();
            drop(cleanup_channel);

            handle.exec_finished(&channel_id).await.unwrap();
        });

        Ok(())
    }

    // open_pty
    // TODO: Consider having a single "channel input" stream that takes an enum and handles both stdin and pty resizing
    #[allow(clippy::too_many_arguments, clippy::type_complexity)]
    pub async fn open_pty(
        &self,
        _channel_id: String,
        width: u16,
        height: u16,
        mut resize_stream: mpsc::Receiver<(u16, u16)>,
        mut input_stream: mpsc::Receiver<Bytes>,
        output_stream: Sender<String>,
        mut cancel_rx: oneshot::Receiver<()>,
    ) -> Result<()> {
        let mut channel = self.session.channel_session().await?;

        // TODO(ellie): allow specifying mode and dimensions
        // Investigate what TERM is best to use for us
        channel
            .request_pty(
                "xterm-256color",
                None,
                Some((width as u32, height as u32, 0, 0)),
            )
            .await?;
        channel.shell().await?; // Start a shell session

        // Handle both reading and writing in a single task
        // channel does not impl clone sooooo.
        tokio::task::spawn(async move {
            let mut buffer = [0; 1024];

            loop {
                tokio::select! {
                    // Check if we've been asked to cancel
                    _ = &mut cancel_rx => {
                        log::debug!("SSH PTY session cancelled");
                        break;
                    }

                    resize = resize_stream.recv() => {
                        match resize {
                            Some((width, height)) => {
                                let _ = channel.request_pty_size(width as u32, height as u32, None, None).await;
                            }
                            None => {
                                log::debug!("SSH resize stream closed");
                                break;
                            }
                        }
                    }

                    // Try to read from the channel
                    read_result = channel.read(&mut buffer) => {
                        match read_result {
                            Ok(n) if n > 0 => {
                                if let Err(e) = output_stream.send(String::from_utf8_lossy(&buffer[..n]).to_string()).await {
                                    log::error!("Failed to send output to stream: {}", e);
                                    break;
                                }
                            }
                            Ok(_) => { // we can only read 0 if the channel is closed. match on _ because compilers are silly
                                log::debug!("SSH channel closed");
                                break;
                            }
                            Err(e) => {
                                log::error!("Error reading from channel: {}", e);
                                break;
                            }
                        }
                    }

                    // Try to read from the input stream
                    input_result = input_stream.recv() => {
                        match input_result {
                            Some(input) => {
                                if let Err(e) = channel.write_all(&input).await {
                                    log::error!("Failed to write to channel: {}", e);
                                    break;
                                }
                            }
                            None => {
                                log::debug!("SSH input stream closed");
                                break;
                            }
                        }
                    }
                }
            }

            // Clean up
            let _ = channel.send_eof().await;
            let _ = channel.close().await;
        });

        Ok(())
    }
}
