// Copied from atuin
// We need to make some tweaks for usage in the desktop app,
// and i'm currently unsure how they will end up looking
// Iterate on it here and upstream in the future _if it makes sense_

use std::collections::{HashMap, HashSet};

use unicode_segmentation::UnicodeSegmentation;

use atuin_client::settings::Settings;

use crate::db::UIHistory;

fn first_non_whitespace(s: &str) -> Option<usize> {
    s.char_indices()
        // find the first non whitespace char
        .find(|(_, c)| !c.is_ascii_whitespace())
        // return the index of that char
        .map(|(i, _)| i)
}

fn first_whitespace(s: &str) -> usize {
    s.char_indices()
        // find the first whitespace char
        .find(|(_, c)| c.is_ascii_whitespace())
        // return the index of that char, (or the max length of the string)
        .map_or(s.len(), |(i, _)| i)
}

fn interesting_command<'a>(settings: &Settings, mut command: &'a str) -> &'a str {
    // Sort by length so that we match the longest prefix first
    let mut common_prefix = settings.stats.common_prefix.clone();
    common_prefix.sort_by_key(|b| std::cmp::Reverse(b.len()));

    // Trim off the common prefix, if it exists
    for p in &common_prefix {
        if command.starts_with(p) {
            let i = p.len();
            let prefix = &command[..i];
            command = command[i..].trim_start();
            if command.is_empty() {
                // no commands following, just use the prefix
                return prefix;
            }
            break;
        }
    }

    // Sort the common_subcommands by length so that we match the longest subcommand first
    let mut common_subcommands = settings.stats.common_subcommands.clone();
    common_subcommands.sort_by_key(|b| std::cmp::Reverse(b.len()));

    // Check for a common subcommand
    for p in &common_subcommands {
        if command.starts_with(p) {
            // if the subcommand is the same length as the command, then we just use the subcommand
            if p.len() == command.len() {
                return command;
            }
            // otherwise we need to use the subcommand + the next word
            let non_whitespace = first_non_whitespace(&command[p.len()..]).unwrap_or(0);
            let j =
                p.len() + non_whitespace + first_whitespace(&command[p.len() + non_whitespace..]);
            return &command[..j];
        }
    }
    // Return the first word if there is no subcommand
    &command[..first_whitespace(command)]
}

fn split_at_pipe(command: &str) -> Vec<&str> {
    let mut result = vec![];
    let mut quoted = false;
    let mut start = 0;
    let mut graphemes = UnicodeSegmentation::grapheme_indices(command, true);

    while let Some((i, c)) = graphemes.next() {
        let current = i;
        match c {
            "\"" => {
                if command[start..current] != *"\"" {
                    quoted = !quoted;
                }
            }
            "'" => {
                if command[start..current] != *"'" {
                    quoted = !quoted;
                }
            }
            "\\" => if graphemes.next().is_some() {},
            "|" => {
                if !quoted {
                    if current > start && command[start..].starts_with('|') {
                        start += 1;
                    }
                    result.push(&command[start..current]);
                    start = current;
                }
            }
            _ => {}
        }
    }
    if command[start..].starts_with('|') {
        start += 1;
    }
    result.push(&command[start..]);
    result
}

pub fn top_commands(
    settings: &Settings,
    history: &[UIHistory],
    count: usize,
    ngram_size: usize,
) -> Option<Vec<(String, u64)>> {
    let mut commands = HashSet::<&str>::with_capacity(history.len());
    let mut prefixes = HashMap::<Vec<&str>, usize>::with_capacity(history.len());

    for i in history {
        // just in case it somehow has a leading tab or space or something (legacy atuin didn't ignore space prefixes)
        let command = i.command.trim();
        let prefix = interesting_command(settings, command);

        if settings.stats.ignored_commands.iter().any(|c| c == prefix) {
            continue;
        }

        commands.insert(command);

        split_at_pipe(i.command.trim())
            .iter()
            .map(|l| {
                let command = l.trim();
                commands.insert(command);
                command
            })
            .collect::<Vec<_>>()
            .windows(ngram_size)
            .for_each(|w| {
                *prefixes
                    .entry(w.iter().map(|c| interesting_command(settings, c)).collect())
                    .or_default() += 1;
            });
    }

    let mut top = prefixes.into_iter().collect::<Vec<_>>();

    top.sort_unstable_by_key(|x| std::cmp::Reverse(x.1));
    top.truncate(count);

    if top.is_empty() {
        return None;
    }

    Some(
        top.into_iter()
            .map(|t| (t.0.into_iter().map(|s| s.to_string()).collect(), t.1 as u64))
            .collect(),
    )
}
