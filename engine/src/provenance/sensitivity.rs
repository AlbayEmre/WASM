/// Minimal glob matcher (subset: `**` and `*`), ported from the TS `glob.ts`.
fn glob_to_regex_parts(glob: &str) -> String {
    // Build a regex string by escaping metacharacters and expanding wildcards.
    let normalized = glob.replace('\\', "/");
    let mut out = String::from("^");
    let bytes = normalized.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let c = bytes[i] as char;
        match c {
            '*' => {
                if i + 1 < bytes.len() && bytes[i + 1] as char == '*' {
                    out.push_str(".*");
                    i += 2;
                    continue;
                }
                out.push_str("[^/]*");
            }
            '.' | '+' | '^' | '$' | '(' | ')' | '|' | '[' | ']' | '{' | '}' | '\\' => {
                out.push('\\');
                out.push(c);
            }
            other => out.push(other),
        }
        i += 1;
    }
    out.push('$');
    out
}

/// Tiny matcher for the produced patterns. We avoid a regex crate dependency
/// (smaller WASM) and instead implement a direct glob match.
fn glob_match(pattern: &str, path: &str) -> bool {
    // Direct recursive glob match over normalized forward-slash paths.
    let p: Vec<char> = pattern.replace('\\', "/").chars().collect();
    let s: Vec<char> = path.replace('\\', "/").chars().collect();
    matches_from(&p, 0, &s, 0)
}

fn matches_from(p: &[char], pi: usize, s: &[char], si: usize) -> bool {
    if pi == p.len() {
        return si == s.len();
    }
    if p[pi] == '*' {
        // `**` matches across separators; `*` matches within a segment.
        let double = pi + 1 < p.len() && p[pi + 1] == '*';
        let next = if double { pi + 2 } else { pi + 1 };
        // try consuming zero or more chars
        let mut k = si;
        loop {
            if matches_from(p, next, s, k) {
                return true;
            }
            if k == s.len() {
                return false;
            }
            if !double && s[k] == '/' {
                return false; // single * cannot cross a separator
            }
            k += 1;
        }
    }
    if si < s.len() && (p[pi] == s[si]) {
        return matches_from(p, pi + 1, s, si + 1);
    }
    false
}

pub fn matches_any(fs_path: &str, globs: &[String]) -> bool {
    let path = fs_path.replace('\\', "/");
    globs.iter().any(|g| glob_match(g, &path))
}

pub fn is_sensitive(fs_path: &str, sensitive: &[String]) -> bool {
    matches_any(fs_path, sensitive)
}

// `glob_to_regex_parts` is retained for parity with the TS implementation and
// potential future regex-based matching; silence dead-code in lib builds.
#[allow(dead_code)]
fn _keep(glob: &str) -> String {
    glob_to_regex_parts(glob)
}
