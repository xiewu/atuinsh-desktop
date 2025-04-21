use super::session::{Authentication, Session};
use eyre::Result;
use std::collections::HashMap;

// A pool of ssh connections
// This avoids opening several ssh connections to the same host
// Intended to be wrapped by an actor in our runtime, so we do not use
// thread safe primitives

pub struct Pool {
    /// A map of ssh connections, host -> session
    /// Session is safe to clone and use concurrently
    pub connections: HashMap<String, Session>,
}

impl Default for Pool {
    fn default() -> Self {
        Pool::new()
    }
}

impl Pool {
    pub fn new() -> Self {
        Pool {
            connections: HashMap::new(),
        }
    }

    /// Connect to a host and return a session
    /// If the session already exists, return it
    pub async fn connect(
        &mut self,
        host: &str,
        username: Option<&str>,
        auth: Option<Authentication>,
    ) -> Result<Session> {
        let username = username.unwrap_or("root");

        if let Some(session) = self.get(host, username) {
            Ok(session.clone())
        } else {
            let session = Session::open(host).await?;
            session.authenticate(auth, Some(username)).await?;

            let key = format!("{}@{}", username, host);
            self.connections.insert(key, session.clone());

            Ok(session)
        }
    }

    pub fn get(&self, host: &str, username: &str) -> Option<Session> {
        self.connections
            .get(&format!("{}@{}", username, host))
            .cloned()
    }

    pub async fn disconnect(&mut self, host: &str, username: &str) -> Result<()> {
        let key = format!("{}@{}", username, host);
        if let Some(session) = self.connections.remove(&key) {
            session.disconnect().await?;
        }

        Ok(())
    }
}
